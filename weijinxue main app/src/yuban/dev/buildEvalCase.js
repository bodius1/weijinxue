import { buildLearnerContextForGrading } from '../conversation/buildGradingPrompt.js'

/**
 * @param {{
 *   currentTurn: import('../conversation/turnTypes.js').StoryBeatTurn,
 *   state: import('../StoryStateContext.jsx').YubanStoryState | null,
 *   debugRecord: import('./TurnDebugRecord.js').TurnDebugRecord,
 *   useNormalized?: import('../conversation/turnTypes.js').ThreeVoicesResponse | null,
 * }} params
 */
export function buildEvalCase({ currentTurn, state, debugRecord, useNormalized }) {
  const norm =
    useNormalized ??
    /** @type {import('../conversation/turnTypes.js').ThreeVoicesResponse | null} */ (
      debugRecord.voicesNormalized
    )

  const studentReply = debugRecord.studentReplyRaw ?? ''
  const hsk = Number(state?.hskLevel ?? 1)

  return {
    name: `${currentTurn.dialogue.hanzi} → ${studentReply}`.slice(0, 120),
    npcText: currentTurn.dialogue.hanzi,
    npcPinyin: currentTurn.dialogue.pinyin,
    npcEnglish: currentTurn.dialogue.english,
    studentReply,
    taskGoal: currentTurn.productionPrompt,
    patternHint: currentTurn.expectedPatternHint ?? '',
    hskLevel: `HSK${hsk}`,
    learnerProfile: {
      hskLevel,
      snapshotText: debugRecord.learnerProfileSnapshot ?? buildLearnerContextForGrading(state),
      patternMastery: state?.patternMastery ?? {},
    },
    weaknessProfile: debugRecord.weaknessProfileSnapshot ?? '',
    expected: {
      evaluation: norm?.evaluation ?? norm?.verdict ?? '',
      taskCompleted: norm?.taskCompleted ?? '',
      detectedIntent: norm?.detectedIntent ?? '',
      notes: '',
    },
  }
}
