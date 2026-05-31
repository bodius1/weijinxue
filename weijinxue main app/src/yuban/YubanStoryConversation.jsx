import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { callYubanAI } from './yubanApi.js'
import { useYubanTurn } from './conversation/useYubanTurn.js'
import { useStoryState } from './StoryStateContext.jsx'
import { isDevModeEnabled } from './dev/useDevMode.js'
import { StoryBeat } from './components/StoryBeat.jsx'
import { ProductionGap } from './components/ProductionGap.jsx'
import { ConfidenceGate } from './components/ConfidenceGate.jsx'
import { ThreeVoices } from './components/ThreeVoices.jsx'
import { TeaBreak } from './components/TeaBreak.jsx'
import { TurnHistory } from './components/TurnHistory.jsx'
import { DevModeInspector } from './dev/DevModeInspector.jsx'
import { TokenBudgetPanel } from './dev/TokenBudgetPanel.jsx'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * @param {{ onTurnHistoryChange?: (history: Array<{ evaluation?: string }>) => void }} props
 */
export default function YubanStoryConversation({ onTurnHistoryChange }) {
  const { state, isOnboarded } = useStoryState()
  const {
    phase,
    currentTurn,
    voicesResponse,
    error,
    pendingReply,
    teaBreak,
    advanceStory,
    submitReply,
    recordConfidence,
    regradeWithRecovery,
    skipToVoices,
    continueStory,
    dismissTeaBreak,
    debugRecord,
    replayGradeLoading,
    replayVoicesGradeFromDev,
    beatLoadingPhase,
    beatLoadingMessage,
    showQuickFallbackOffer,
    setBeatLoadingMessage,
    setShowQuickFallbackOffer,
    useQuickFallbackBeat,
    reportProductionGapVisible,
  } = useYubanTurn(callYubanAI)

  const [history, setHistory] = useState(/** @type {import('./components/TurnHistory.jsx').HistoryEntry[]} */ ([]))
  const [gapResetKey, setGapResetKey] = useState(0)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!isOnboarded || startedRef.current) return
    if (phase === 'idle' && !currentTurn) {
      startedRef.current = true
      void advanceStory()
    }
  }, [isOnboarded, phase, currentTurn, advanceStory])

  const turnHistoryForTrend = useMemo(
    () =>
      history
        .filter((h) => h.voices?.evaluation)
        .map((h) => ({ evaluation: h.voices?.evaluation })),
    [history],
  )

  useEffect(() => {
    onTurnHistoryChange?.(turnHistoryForTrend)
  }, [turnHistoryForTrend, onTurnHistoryChange])

  const archiveCurrentTurn = useCallback(() => {
    if (!currentTurn) return
    setHistory((prev) => [
      ...prev,
      {
        id: uid(),
        turn: currentTurn,
        voices: voicesResponse,
      },
    ])
  }, [currentTurn, voicesResponse])

  const handleSubmit = useCallback(
    (text) => {
      setGapResetKey((k) => k + 1)
      void submitReply(text)
    },
    [submitReply],
  )

  const handleContinue = useCallback(async () => {
    archiveCurrentTurn()
    await continueStory({ continueClickedAt: Date.now() })
  }, [archiveCurrentTurn, continueStory])

  useEffect(() => {
    if (phase !== 'loading_beat') {
      setBeatLoadingMessage(null)
      setShowQuickFallbackOffer(false)
      return
    }
    const t8 = window.setTimeout(() => {
      setBeatLoadingMessage('Still generating your next story beat…')
    }, 8000)
    const t20 = window.setTimeout(() => {
      setBeatLoadingMessage('This is taking longer than usual.')
      setShowQuickFallbackOffer(true)
    }, 20000)
    return () => {
      window.clearTimeout(t8)
      window.clearTimeout(t20)
    }
  }, [phase, setBeatLoadingMessage, setShowQuickFallbackOffer])

  useEffect(() => {
    if (phase === 'awaiting_student' && currentTurn) {
      requestAnimationFrame(() => {
        reportProductionGapVisible()
      })
    }
  }, [phase, currentTurn, reportProductionGapVisible])

  const loadingPhaseLabel = useMemo(() => {
    const map = {
      preparing: 'Starting…',
      profile: 'Loading learner profile…',
      prompt: 'Building story prompt…',
      model: 'Calling AI model…',
      parse: 'Parsing story beat…',
      coherence: 'Checking for repetition…',
      fallback: 'Using fallback beat…',
      render: 'Preparing your turn…',
    }
    return beatLoadingPhase ? map[beatLoadingPhase] ?? beatLoadingPhase : null
  }, [beatLoadingPhase])

  const productionDisabled = phase !== 'awaiting_student'
  const showActiveBeat =
    currentTurn &&
    phase !== 'idle' &&
    phase !== 'loading_tea_break' &&
    phase !== 'showing_tea_break'

  return (
    <div className="flex min-h-[280px] flex-1 flex-col rounded-2xl border border-taupe bg-[#1C1A16] shadow-inner">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
        <div className="mx-auto max-w-xl space-y-4">
          {isDevModeEnabled() ? <TokenBudgetPanel /> : null}
          <TurnHistory entries={history} />

          {phase === 'loading_beat' ? (
            <div className="space-y-2 rounded-lg border border-[#D4A843]/20 bg-[#1A1814]/80 p-3">
              <p className="text-sm text-[#8C7A52]">✨ The story continues…</p>
              {beatLoadingMessage ? (
                <p className="text-xs text-[#D4A843]/90">{beatLoadingMessage}</p>
              ) : null}
              {isDevModeEnabled() && loadingPhaseLabel ? (
                <p className="font-mono text-[10px] text-purple-400/80">Phase: {loadingPhaseLabel}</p>
              ) : null}
              {showQuickFallbackOffer ? (
                <button
                  type="button"
                  onClick={() => useQuickFallbackBeat()}
                  className="rounded-md border border-[#D4A843]/40 bg-[#D4A843]/10 px-3 py-1.5 text-xs text-[#E8D5A3] transition hover:bg-[#D4A843]/20"
                >
                  Use quick fallback beat
                </button>
              ) : null}
            </div>
          ) : null}

          {phase === 'loading_tea_break' ? (
            <p className="text-sm text-[#8C7A52]">🍵 Brewing a tea break…</p>
          ) : null}

          {phase === 'showing_tea_break' && teaBreak ? (
            <TeaBreak insight={teaBreak} onDismiss={() => void dismissTeaBreak()} />
          ) : null}

          {showActiveBeat ? (
            <StoryBeat turn={currentTurn} patternMastery={state?.patternMastery} />
          ) : null}

          {showActiveBeat ? (
            <DevModeInspector section="beat" debugRecord={debugRecord} />
          ) : null}

          {phase === 'awaiting_student' && currentTurn ? (
            <ProductionGap
              prompt={currentTurn.productionPrompt}
              expectedHint={currentTurn.expectedPatternHint}
              npcDialogueHanzi={currentTurn.dialogue?.hanzi}
              onSubmit={handleSubmit}
              onSkip={() => void skipToVoices()}
              disabled={productionDisabled}
              resetKey={gapResetKey}
            />
          ) : null}

          {phase === 'awaiting_confidence' && pendingReply ? (
            <ConfidenceGate studentReply={pendingReply} onConfirm={(level) => void recordConfidence(level)} />
          ) : null}

          {phase === 'loading_voices' ? (
            <p className="text-sm text-[#8C7A52]">🎭 Asking 老师, 朋友, and 路人…</p>
          ) : null}

          {phase === 'showing_voices' && voicesResponse ? (
            <>
              <ThreeVoices
                response={voicesResponse}
                onContinue={() => void handleContinue()}
                onRecovery={() => void regradeWithRecovery()}
              />
              <DevModeInspector
                section="voices"
                debugRecord={debugRecord}
                currentTurn={currentTurn}
                state={state}
                replayGradeLoading={replayGradeLoading}
                onReplayGrade={replayVoicesGradeFromDev}
              />
            </>
          ) : null}

          {error ? (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
              Something went wrong: {error}
              <button type="button" onClick={() => void advanceStory()} className="ml-2 underline">
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {state?.city ? (
        <div className="border-t border-[#3A3529] px-3 py-2 text-center text-[10px] text-[#8C7A52]">
          Living your story in {state.city} · HSK {state.hskLevel ?? 1}
          {turnHistoryForTrend.length >= 3 ? (
            <span className="ml-2 opacity-80">
              ·{' '}
              {turnHistoryForTrend.filter((t) => t.evaluation === 'correct').length /
                turnHistoryForTrend.length >=
              0.6
                ? '↗ improving'
                : '→ practicing'}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
