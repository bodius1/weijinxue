import { useCallback, useRef, useState } from 'react'
import { useStoryState } from '../StoryStateContext.jsx'
import { buildStoryBeatPrompt } from './buildSystemPrompt.js'
import { gradeYubanTurn } from '../grading/gradeYubanTurn.js'
import { getStoryGenerationMode, shouldUseLocalStoryBeat } from '../config/yubanConfig.js'
import { pickLocalStoryBeat } from '../story/localStoryBeats.js'
import { readTokenBudget, updateTokenBudget, recordLlmUsage, recordTokensSaved } from '../grading/tokenBudget.js'
import { parseAIJson, validateStoryBeat } from './parseAIResponse.js'
import { getYubanModelInfo } from '../yubanApi.js'
import {
  normalizeGradingResponse,
  applyRecoveryText,
  buildRecoveryMistakeEntry,
} from './gradingSchema.js'
import { getDuplicateBeatReason, pickFallbackBeat } from './storyBeatGuards.js'
import {
  createStoryBeatTiming,
  markStoryBeatPhase,
  finalizeStoryBeatTiming,
  logStoryBeatTiming,
  estimateTokenCount,
} from '../dev/storyBeatTiming.js'
import { buildPatternMasteryPatch } from '../curriculum/patternMasteryTracker.js'
import { buildWeaknessProfile } from '../curriculum/weaknessProfile.js'
import { shouldShowTeaBreak, generateTeaBreak } from '../curriculum/teaBreakTrigger.js'
import { isDevModeEnabled } from '../dev/useDevMode.js'
import { buildLearnerContextForGrading } from './buildGradingPrompt.js'
import { createEmptyTurnDebugRecord, snapshotCurrentVoicesGrade } from '../dev/TurnDebugRecord.js'
import { replayVoicesGrade as runReplayVoicesGrade } from '../dev/replayVoicesGrade.js'

/**
 * @param {import('../dev/TurnDebugRecord.js').TurnDebugRecord} d
 * @param {Partial<import('../dev/TurnDebugRecord.js').TurnDebugRecord>} patch
 */
function applyVoicesDebugFinalize(d, patch) {
  const merged = { ...d, ...patch }
  if (merged.originalVoices || (!merged.voicesRaw && !merged.voicesNormalized)) {
    return merged
  }
  const gradedAt = merged.voicesGradedAt ?? Date.now()
  return {
    ...merged,
    voicesGradedAt: gradedAt,
    originalVoices: snapshotCurrentVoicesGrade({ ...merged, voicesGradedAt: gradedAt }),
  }
}

/**
 * @param {import('./turnTypes.js').ThreeVoicesResponse} normalized
 */
function isGradingSuccess(normalized) {
  return (
    normalized.evaluation === 'correct' ||
    normalized.recoveryApplied === true ||
    (normalized.evaluation === 'almost' && normalized.taskCompleted === true)
  )
}

/**
 * @param {import('../StoryStateContext.jsx').YubanStoryState | null} state
 * @param {import('./turnTypes.js').StoryBeatTurn} parsed
 */
function buildBeatSideEffectPatch(state, parsed) {
  const s = state ?? {}
  /** @type {Record<string, import('../helpers/vocabHelpers.js').VocabEntry>} */
  const vocabulary = { ...(s.vocabulary ?? {}) }
  const now = Date.now()

  for (const word of parsed.newVocab ?? []) {
    const hanzi = String(word.hanzi ?? '').trim()
    if (!hanzi) continue
    const existing = vocabulary[hanzi]
    vocabulary[hanzi] = existing
      ? {
          ...existing,
          lastSeen: now,
          encounterCount: existing.encounterCount + 1,
          mastery: 'warm',
        }
      : {
          pinyin: String(word.pinyin ?? '').trim(),
          english: String(word.english ?? '').trim(),
          firstSeen: now,
          lastSeen: now,
          encounterCount: 1,
          mastery: 'warm',
        }
  }

  /** @type {Record<string, object>} */
  const npcs = { ...(s.npcs ?? {}) }
  const npcToAdd = parsed.introducedNPC ?? (parsed.speaker?.isNew ? parsed.speaker : null)
  if (npcToAdd?.id && !npcs[npcToAdd.id]) {
    npcs[npcToAdd.id] = {
      chineseName: npcToAdd.chineseName,
      pinyinName: npcToAdd.pinyinName,
      role: npcToAdd.role,
      notes: '',
      firstMet: `session ${s.sessionsCompleted ?? 0}`,
      relationship: 'new_acquaintance',
    }
  }

  let storyLog = Array.isArray(s.storyLog) ? [...s.storyLog] : []
  if (parsed.storyLogEntry) {
    storyLog = [
      {
        summary: parsed.storyLogEntry,
        scenario: s.currentScenario,
        date: new Date().toISOString(),
      },
      ...storyLog,
    ].slice(0, 10)
  }

  return { vocabulary, npcs, storyLog }
}

/**
 * @param {(systemPrompt: string, userMessage: string) => Promise<string>} callAI
 */
export function useYubanTurn(callAI) {
  const { state, updateState } = useStoryState()
  const [currentTurn, setCurrentTurn] = useState(/** @type {import('./turnTypes.js').StoryBeatTurn | null} */ (null))
  const [voicesResponse, setVoicesResponse] = useState(
    /** @type {import('./turnTypes.js').ThreeVoicesResponse | null} */ (null),
  )
  const [phase, setPhase] = useState(/** @type {import('./turnTypes.js').TurnPhase} */ ('idle'))
  const [error, setError] = useState(/** @type {string | null} */ (null))
  const [pendingReply, setPendingReply] = useState(/** @type {string | null} */ (null))
  const [teaBreak, setTeaBreak] = useState(
    /** @type {null | { title: string, body: string, trigger?: object }} */ (null),
  )
  const [debugRecord, setDebugRecord] = useState(() => createEmptyTurnDebugRecord())
  const [replayGradeLoading, setReplayGradeLoading] = useState(false)
  const [beatLoadingPhase, setBeatLoadingPhase] = useState(/** @type {string | null} */ (null))
  const [beatLoadingMessage, setBeatLoadingMessage] = useState(/** @type {string | null} */ (null))
  const [showQuickFallbackOffer, setShowQuickFallbackOffer] = useState(false)
  const activeTimingRef = useRef(/** @type {import('../dev/storyBeatTiming.js').StoryBeatTiming | null} */ (null))
  const advanceRunIdRef = useRef(0)

  const reportProductionGapVisible = useCallback(() => {
    const timing = activeTimingRef.current
    if (!timing) return
    timing.productionGapVisibleAt = Date.now()
    markStoryBeatPhase(timing, 'productionGapVisible')
    const summary = finalizeStoryBeatTiming(timing)
    if (isDevModeEnabled()) {
      logStoryBeatTiming(summary)
      setDebugRecord((d) => ({
        ...d,
        storyBeatTiming: summary,
        beatDurationMs: summary?.totalContinueToVisibleMs ?? summary?.totalWallMs ?? d.beatDurationMs,
      }))
    }
    activeTimingRef.current = null
    setShowQuickFallbackOffer(false)
    setBeatLoadingMessage(null)
    setBeatLoadingPhase(null)
  }, [])

  const advanceStory = useCallback(
    async (/** @type {{ timing?: import('../dev/storyBeatTiming.js').StoryBeatTiming | null, continueClickedAt?: number, stateSnapshot?: typeof state, sessionPatch?: Record<string, unknown>, useFallbackOnly?: boolean }} */ opts = {}) => {
      if (!state?.initialized) return

      const runId = (advanceRunIdRef.current += 1)
      const dev = isDevModeEnabled()
      const timing = opts.timing ?? (dev ? createStoryBeatTiming() : null)
      activeTimingRef.current = timing
      if (timing) {
        timing.wasDevModeEnabled = dev
        if (opts.continueClickedAt) {
          timing.marks.continueButtonClicked = opts.continueClickedAt
        }
      }

      setPhase('loading_beat')
      setBeatLoadingPhase('preparing')
      setBeatLoadingMessage(null)
      setShowQuickFallbackOffer(false)
      setError(null)
      setVoicesResponse(null)
      setTeaBreak(null)

      const stateForPrompt = opts.stateSnapshot ?? state
      const hskLevel = Number(stateForPrompt.hskLevel ?? 1)
      const recent = stateForPrompt.recentProductionBeats ?? []

      try {
        setBeatLoadingPhase('profile')
        markStoryBeatPhase(timing, 'loadLearnerProfileStart')
        const weaknessSnapshot = buildWeaknessProfile(stateForPrompt) || null
        markStoryBeatPhase(timing, 'loadLearnerProfileEnd')

        /** @type {import('./turnTypes.js').StoryBeatTurn} */
        let parsed
        let lastRaw = ''
        /** @type {'local_template' | 'llm' | 'local_fallback_guard'} */
        let storyBeatSource = 'llm'

        if (opts.useFallbackOnly) {
          storyBeatSource = 'local_fallback_guard'
          setBeatLoadingPhase('fallback')
          markStoryBeatPhase(timing, 'fallbackOrRetryStart', { reason: 'user_quick_fallback' })
          parsed = /** @type {import('./turnTypes.js').StoryBeatTurn} */ (
            pickFallbackBeat(hskLevel, recent)
          )
          validateStoryBeat(parsed)
          if (timing) {
            timing.fallbackUsed = true
            timing.retryReason = 'user_quick_fallback'
          }
          markStoryBeatPhase(timing, 'fallbackOrRetryEnd', {
            reason: 'user_quick_fallback',
            skippedModelRetry: true,
          })
        } else {
          const storyMode = getStoryGenerationMode(hskLevel)
          const budget = readTokenBudget()

          markStoryBeatPhase(timing, 'buildStoryPromptStart')
          if (shouldUseLocalStoryBeat(budget.turnIndex, storyMode)) {
            const localBeat = pickLocalStoryBeat({
              hskLevel,
              scenario: stateForPrompt.currentScenario,
              recentProductionBeats: recent,
            })
            if (localBeat) {
              parsed = /** @type {import('./turnTypes.js').StoryBeatTurn} */ (localBeat)
              storyBeatSource = 'local_template'
              lastRaw = '(local_template)'
              const b2 = readTokenBudget()
              updateTokenBudget({ localStoryBeats: b2.localStoryBeats + 1 })
              recordTokensSaved(3800)
              markStoryBeatPhase(timing, 'buildStoryPromptEnd', {
                charCount: 0,
                tokenEstimate: 0,
                storyBeatSource,
              })
            }
          }

          if (!parsed) {
            setBeatLoadingPhase('prompt')
            const beatPrompt = buildStoryBeatPrompt(stateForPrompt)
            const charCount = beatPrompt.length
            const tokenEstimate = estimateTokenCount(beatPrompt)
            markStoryBeatPhase(timing, 'buildStoryPromptEnd', { charCount, tokenEstimate, storyBeatSource: 'llm' })

            if (dev) {
              setDebugRecord({
                ...createEmptyTurnDebugRecord(),
                beatPrompt,
                beatStartedAt: Date.now(),
                weaknessProfileSnapshot: weaknessSnapshot,
                storyBeatSource: 'llm',
                promptCharCount: charCount,
              })
            }

            setBeatLoadingPhase('model')
            const modelInfo = getYubanModelInfo()
            markStoryBeatPhase(timing, 'modelCallStart', {
              attempt: 1,
              provider: modelInfo?.provider,
              model: modelInfo?.model,
            })
            const modelStart = Date.now()
            lastRaw = await callAI(beatPrompt, 'Generate the next story beat.')
            const modelMs = Date.now() - modelStart
            if (runId !== advanceRunIdRef.current) return

            recordLlmUsage({ inputChars: charCount, outputChars: lastRaw.length })

            timing?.modelCalls.push({
              attempt: 1,
              provider: modelInfo?.provider,
              model: modelInfo?.model,
              ms: modelMs,
            })
            markStoryBeatPhase(timing, 'modelCallEnd', { attempt: 1, ms: modelMs })

            setBeatLoadingPhase('parse')
            markStoryBeatPhase(timing, 'parseStoryBeatStart')
            parsed = /** @type {import('./turnTypes.js').StoryBeatTurn} */ (parseAIJson(lastRaw))
            validateStoryBeat(parsed)
            markStoryBeatPhase(timing, 'parseStoryBeatEnd')

            setBeatLoadingPhase('coherence')
            markStoryBeatPhase(timing, 'storyCoherenceCheckStart')
            const dupReason = getDuplicateBeatReason(parsed, recent)
            markStoryBeatPhase(timing, 'storyCoherenceCheckEnd', { duplicateReason: dupReason })

            if (dupReason) {
              setBeatLoadingPhase('fallback')
              markStoryBeatPhase(timing, 'fallbackOrRetryStart', { reason: dupReason })
              parsed = /** @type {import('./turnTypes.js').StoryBeatTurn} */ (
                pickFallbackBeat(hskLevel, recent)
              )
              validateStoryBeat(parsed)
              storyBeatSource = 'local_fallback_guard'
              if (timing) {
                timing.fallbackUsed = true
                timing.retryReason = dupReason
                timing.retryCount = 0
              }
              markStoryBeatPhase(timing, 'fallbackOrRetryEnd', {
                reason: dupReason,
                skippedModelRetry: true,
              })
            }
          } else if (dev) {
            setDebugRecord({
              ...createEmptyTurnDebugRecord(),
              beatPrompt: '(local template — no LLM)',
              beatStartedAt: Date.now(),
              weaknessProfileSnapshot: weaknessSnapshot,
              storyBeatSource,
              beatParsed: parsed,
              beatRaw: lastRaw,
            })
          }
        }

        if (runId !== advanceRunIdRef.current) return

        {
          const bEnd = readTokenBudget()
          updateTokenBudget({ turnIndex: bEnd.turnIndex + 1 })
        }

        if (dev) {
          setDebugRecord((d) => ({
            ...d,
            beatRaw: lastRaw ?? d.beatRaw,
            beatParsed: parsed,
            storyBeatSource: d.storyBeatSource ?? storyBeatSource,
          }))
        }

        setBeatLoadingPhase('render')
        markStoryBeatPhase(timing, 'setReactStateStart')
        setCurrentTurn(parsed)
        setPhase('awaiting_student')
        markStoryBeatPhase(timing, 'setReactStateEnd')

        const patch = buildBeatSideEffectPatch(state, parsed)
        const fullPatch = { ...(opts.sessionPatch ?? {}), ...patch }

        markStoryBeatPhase(timing, 'firestoreWriteStart')
        void updateState(fullPatch)
          .then(() => {
            markStoryBeatPhase(timing, 'firestoreWriteEnd')
          })
          .catch((err) => {
            console.warn('[Yǔbàn] Background Firestore write failed:', err)
            markStoryBeatPhase(timing, 'firestoreWriteEnd', { error: String(err) })
          })
      } catch (err) {
        if (runId !== advanceRunIdRef.current) return
        console.error('Story beat failed:', err)
        setError(err instanceof Error ? err.message : String(err))
        setPhase('idle')
        setBeatLoadingPhase(null)
        activeTimingRef.current = null
      }
    },
    [state, updateState, callAI],
  )

  const useQuickFallbackBeat = useCallback(() => {
    advanceRunIdRef.current += 1
    const timing = activeTimingRef.current ?? (isDevModeEnabled() ? createStoryBeatTiming() : null)
    void advanceStory({ timing, useFallbackOnly: true })
  }, [advanceStory])

  const submitReply = useCallback(
    async (studentReply) => {
      if (!currentTurn) return
      setPendingReply(studentReply)
      setPhase('awaiting_confidence')
    },
    [currentTurn],
  )

  const persistGrading = useCallback(
    async (normalized, studentReply, confidenceLevel, { skipMistakeLog = false } = {}) => {
      if (!currentTurn || !state) return

      const wasCorrect = isGradingSuccess(normalized)

      const confidenceEntry = {
        mistakeType: normalized.mistakeRecord?.type || null,
        confidence: confidenceLevel,
        wasCorrect,
        turnContext: currentTurn.dialogue.hanzi,
        ts: Date.now(),
      }

      const updatedConfLog = [...(state.confidenceLog || []), confidenceEntry].slice(-100)

      /** @type {Record<string, unknown>} */
      const updates = { confidenceLog: updatedConfLog }

      if (!skipMistakeLog && normalized.mistakeRecord) {
        updates.mistakeLog = [
          ...(state.mistakeLog ?? []),
          {
            ...normalized.mistakeRecord,
            turnContext: currentTurn.dialogue.hanzi,
            studentReply,
            confidence: confidenceLevel,
            timestamp: Date.now(),
          },
        ].slice(-50)
      }

      const patternPatch = buildPatternMasteryPatch(
        {
          ...state,
          confidenceLog: updatedConfLog,
          mistakeLog: /** @type {import('../StoryStateContext.jsx').YubanStoryState['mistakeLog']} */ (
            updates.mistakeLog ?? state.mistakeLog
          ),
        },
        currentTurn,
        normalized,
      )
      if (patternPatch) {
        updates.patternMastery = patternPatch
      }

      if (isGradingSuccess(normalized) && currentTurn) {
        const beatEntry = {
          dialogueHanzi: currentTurn.dialogue.hanzi,
          productionPrompt: currentTurn.productionPrompt,
          expectedPatternHint: currentTurn.expectedPatternHint ?? '',
          evaluation: 'correct',
        }
        updates.recentProductionBeats = [beatEntry, ...(state.recentProductionBeats ?? [])].slice(0, 5)
      }

      await updateState(updates)

      setVoicesResponse({
        ...normalized,
        studentReply,
        confidence: confidenceLevel,
      })
      setPhase('showing_voices')
      setPendingReply(null)
    },
    [state, currentTurn, updateState],
  )

  const recordConfidence = useCallback(
    async (confidenceLevel) => {
      if (!pendingReply || !currentTurn || !state) return
      setPhase('loading_voices')
      setError(null)

      try {
        if (pendingReply === '(skipped)') {
          const normalized = normalizeGradingResponse(null, {
            studentReply: pendingReply,
            skipped: true,
          })
          if (isDevModeEnabled()) {
            setDebugRecord((d) => ({
              ...d,
              studentReplyRaw: pendingReply,
              confidenceLevel,
              voicesNormalized: normalized,
            }))
          }
          await persistGrading(normalized, pendingReply, confidenceLevel)
          return
        }

        const voicesStartedAt = Date.now()
        const dev = isDevModeEnabled()
        if (dev) {
          setDebugRecord((d) => ({
            ...d,
            voicesStartedAt,
            voicesRaw: null,
            voicesParsed: null,
            voicesNormalized: null,
            voicesReplayAt: null,
            voicesReplayError: null,
            studentReplyRaw: pendingReply,
            confidenceLevel,
            learnerProfileSnapshot: buildLearnerContextForGrading(state),
            weaknessProfileSnapshot: buildWeaknessProfile(state) || d.weaknessProfileSnapshot,
          }))
        }

        const gradeResult = await gradeYubanTurn(state, currentTurn, pendingReply, callAI)

        if (dev) {
          setDebugRecord((d) =>
            applyVoicesDebugFinalize(d, {
              voicesNormalized: gradeResult.normalized,
              voicesGradedAt: Date.now(),
              voicesPrompt: gradeResult.voicesPrompt ?? d.voicesPrompt ?? '(local — no LLM prompt)',
              voicesRaw: gradeResult.voicesRaw ?? '(local grader)',
              voicesParsed: gradeResult.voicesParsed ?? null,
              gradingSource: gradeResult.source,
              tokensSavedEstimate: gradeResult.tokensSavedEstimate ?? 0,
              voicesDurationMs: Date.now() - voicesStartedAt,
            }),
          )
        }

        await persistGrading(gradeResult.normalized, pendingReply, confidenceLevel)
      } catch (err) {
        console.error('Three voices failed:', err)
        setError(err instanceof Error ? err.message : String(err))
        setPhase('awaiting_student')
        setPendingReply(null)
      }
    },
    [state, currentTurn, pendingReply, callAI, persistGrading],
  )

  const replayVoicesGradeFromDev = useCallback(
    async (/** @type {{ useCapturedPrompt?: boolean }} */ opts = {}) => {
      if (!isDevModeEnabled() || !state || !currentTurn) return
      const reply = debugRecord.studentReplyRaw
      if (!reply || reply === '(skipped)') return

      setReplayGradeLoading(true)
      setDebugRecord((d) => ({ ...d, voicesReplayError: null }))

      try {
        const result = await runReplayVoicesGrade({
          state,
          currentTurn,
          debugRecord,
          callAI,
          useCapturedPrompt: Boolean(opts.useCapturedPrompt),
        })
        setDebugRecord((d) => ({
          ...d,
          voicesPrompt: result.voicesPrompt,
          voicesRaw: result.voicesRaw,
          voicesParsed: result.voicesParsed,
          voicesNormalized: result.voicesNormalized,
          voicesDurationMs: result.voicesDurationMs,
          voicesReplayAt: result.voicesReplayAt,
          voicesReplayError: null,
          originalVoices: result.originalVoices,
          learnerProfileSnapshot: result.learnerProfileSnapshot,
          weaknessProfileSnapshot: result.weaknessProfileSnapshot,
        }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('Replay grade failed:', err)
        setDebugRecord((d) => ({ ...d, voicesReplayError: msg }))
      } finally {
        setReplayGradeLoading(false)
      }
    },
    [state, currentTurn, debugRecord, callAI],
  )

  const regradeWithRecovery = useCallback(async () => {
    if (!voicesResponse?.likelyIntended || !currentTurn || !state) return
    const wrote = voicesResponse.studentWrote || voicesResponse.studentReply || ''
    const intended = voicesResponse.likelyIntended
    const corrected = applyRecoveryText(voicesResponse.studentReply || '', wrote, intended)
    const confidenceLevel = voicesResponse.confidence || 'pretty_sure'

    setPhase('loading_voices')
    setError(null)

    try {
      const recoveryMistake = buildRecoveryMistakeEntry(currentTurn, state, {
        wrote,
        intended,
        taskType: voicesResponse.taskType,
      })

      await updateState({
        mistakeLog: [...(state.mistakeLog ?? []), recoveryMistake].slice(-50),
      })

      const voicesStartedAt = Date.now()
      const dev = isDevModeEnabled()
      if (dev) {
        setDebugRecord((d) => ({
          ...d,
          voicesStartedAt,
          voicesRaw: null,
          voicesParsed: null,
          voicesNormalized: null,
          studentReplyRaw: corrected,
          confidenceLevel,
        }))
      }

      const gradeResult = await gradeYubanTurn(state, currentTurn, corrected, callAI, {
        recoveryNote: `RECOVERY: The student tapped "I meant ${intended}". Their corrected reply is: "${corrected}". Grade this corrected reply generously — the original typo should not count as failure. Prefer verdict "correct" if the corrected text completes the task.`,
      })

      let normalized = {
        ...gradeResult.normalized,
        recoveryApplied: true,
      }
      if (normalized.verdict === 'correct' || normalized.verdict === 'almost') {
        normalized = { ...normalized, evaluation: 'correct' }
      }

      if (dev) {
        setDebugRecord((d) =>
          applyVoicesDebugFinalize(d, {
            voicesNormalized: normalized,
            voicesGradedAt: Date.now(),
            voicesPrompt: gradeResult.voicesPrompt ?? '(local — no LLM prompt)',
            voicesRaw: gradeResult.voicesRaw ?? '(local grader)',
            voicesParsed: gradeResult.voicesParsed ?? null,
            gradingSource: gradeResult.source,
            tokensSavedEstimate: gradeResult.tokensSavedEstimate ?? 0,
            voicesDurationMs: Date.now() - voicesStartedAt,
          }),
        )
      }

      await persistGrading(normalized, corrected, confidenceLevel, { skipMistakeLog: true })
    } catch (err) {
      console.error('Recovery regrade failed:', err)
      setError(err instanceof Error ? err.message : String(err))
      setPhase('showing_voices')
    }
  }, [voicesResponse, currentTurn, state, callAI, updateState, persistGrading])

  const continueStory = useCallback(
    async (/** @type {{ continueClickedAt?: number }} */ opts = {}) => {
      if (!state) return

      const dev = isDevModeEnabled()
      const timing = dev ? createStoryBeatTiming() : null
      if (timing && opts.continueClickedAt) {
        timing.marks.continueButtonClicked = opts.continueClickedAt
      }

      const nextSessions = (state.sessionsCompleted ?? 0) + 1
      const sessionPatch = {
        sessionsCompleted: nextSessions,
        lastSessionAt: Date.now(),
      }
      const nextState = { ...state, ...sessionPatch }

      setVoicesResponse(null)

      const trigger = shouldShowTeaBreak(nextState)
      if (trigger) {
        setPhase('loading_tea_break')
        try {
          const content = await generateTeaBreak(callAI, nextState, trigger)
          setTeaBreak({ ...content, trigger })
          void updateState({
            teaBreaksShown: [...(state.teaBreaksShown || []), { topic: trigger.topic, ts: Date.now() }].slice(
              -20,
            ),
          })
          setPhase('showing_tea_break')
          return
        } catch (err) {
          console.error('Tea break failed', err)
        }
      }

      await advanceStory({
        timing,
        continueClickedAt: opts.continueClickedAt,
        stateSnapshot: nextState,
        sessionPatch,
      })
    },
    [state, updateState, advanceStory, callAI],
  )

  const dismissTeaBreak = useCallback(async () => {
    setTeaBreak(null)
    await advanceStory()
  }, [advanceStory])

  const skipToVoices = useCallback(async () => {
    await submitReply('(skipped)')
  }, [submitReply])

  return {
    phase,
    currentTurn,
    voicesResponse,
    error,
    pendingReply,
    teaBreak,
    debugRecord,
    replayGradeLoading,
    replayVoicesGradeFromDev,
    advanceStory,
    submitReply,
    recordConfidence,
    regradeWithRecovery,
    skipToVoices,
    continueStory,
    dismissTeaBreak,
    beatLoadingPhase,
    beatLoadingMessage,
    showQuickFallbackOffer,
    setBeatLoadingMessage,
    setShowQuickFallbackOffer,
    useQuickFallbackBeat,
    reportProductionGapVisible,
  }
}
