/**
 * Story advance timing utilities + slow-model simulation.
 * Run: node scripts/test-yuban-advance-timing.mjs
 */
import {
  createStoryBeatTiming,
  markStoryBeatPhase,
  finalizeStoryBeatTiming,
  formatTimingBreakdownLines,
  estimateTokenCount,
} from '../src/yuban/dev/storyBeatTiming.js'
import { getDuplicateBeatReason } from '../src/yuban/conversation/storyBeatGuards.js'
import { pickFallbackBeat } from '../src/yuban/conversation/storyBeatGuards.js'

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${msg}`)
  } else {
    failed += 1
    console.error(`  ✗ ${msg}`)
  }
}

console.log('finalizeStoryBeatTiming')
const timing = createStoryBeatTiming()
const t0 = Date.now()
timing.marks.continueButtonClicked = t0
markStoryBeatPhase(timing, 'buildStoryPromptStart')
timing.marks.buildStoryPromptEnd = t0 + 90
markStoryBeatPhase(timing, 'modelCallStart', { attempt: 1 })
timing.modelCalls.push({ attempt: 1, provider: 'groq', model: 'test', ms: 14200 })
timing.marks.modelCallEnd = t0 + 14300
markStoryBeatPhase(timing, 'fallbackOrRetryStart', { reason: 'duplicate_gym' })
timing.fallbackUsed = true
timing.retryReason = 'duplicate_gym'
markStoryBeatPhase(timing, 'fallbackOrRetryEnd', { reason: 'duplicate_gym', skippedModelRetry: true })
timing.marks.fallbackOrRetryEnd = t0 + 14350
timing.meta.fallbackOrRetryEnd = { skippedModelRetry: true }
timing.marks.setReactStateStart = t0 + 14360
timing.marks.setReactStateEnd = t0 + 14440
timing.productionGapVisibleAt = t0 + 14520
timing.marks.firestoreWriteStart = t0 + 14530
timing.marks.firestoreWriteEnd = t0 + 15730

const summary = finalizeStoryBeatTiming(timing)
assert(summary?.totalContinueToVisibleMs === 14520, 'totalContinueToVisibleMs computed')
assert(summary?.modelCall1Ms === 14200, 'model call 1 ms')
assert(summary?.fallbackUsed === true, 'fallback flag')
assert(summary?.retryReason === 'duplicate_gym', 'retry reason')
assert(summary?.skippedModelRetry === true, 'skipped model retry when fallback used')

const lines = formatTimingBreakdownLines(summary)
assert(lines.some((l) => l.includes('14,200') || l.includes('14200')), 'breakdown includes model time')

console.log('\nduplicate → local fallback (no second model call)')
const recent = [
  {
    dialogueHanzi: '你要去哪里?',
    productionPrompt: 'Go to gym',
    expectedPatternHint: '健身房',
    evaluation: 'correct',
  },
]
const dupBeat = {
  dialogue: { hanzi: '你要去哪里?' },
  productionPrompt: 'Go to gym again',
  expectedPatternHint: '健身房',
}
const reason = getDuplicateBeatReason(dupBeat, recent)
assert(reason === 'duplicate_gym' || reason === 'duplicate_where_question', 'duplicate detected')
const fallback = pickFallbackBeat(1, recent)
assert(fallback.dialogue.hanzi !== dupBeat.dialogue.hanzi || !/健身房/.test(fallback.productionPrompt), 'fallback differs')

console.log('\nsimulate slow model — UI phases')
async function simulateSlowAdvance({ modelDelayMs, useFallbackOnly }) {
  const phases = []
  const mark = (p) => phases.push({ phase: p, at: Date.now() })

  mark('loading_beat')
  if (useFallbackOnly) {
    mark('fallback')
    mark('awaiting_student')
    return { phases, usedModel: false }
  }

  mark('model')
  await new Promise((r) => setTimeout(r, modelDelayMs))
  mark('awaiting_student')
  return { phases, usedModel: true }
}

const slow = await simulateSlowAdvance({ modelDelayMs: 50, useFallbackOnly: false })
assert(slow.phases[0].phase === 'loading_beat', 'starts loading')
assert(slow.phases.at(-1).phase === 'awaiting_student', 'ends ready')

const quick = await simulateSlowAdvance({ modelDelayMs: 0, useFallbackOnly: true })
assert(!quick.usedModel, 'fallback skips model')

console.log('\nestimateTokenCount')
assert(estimateTokenCount('abcd'.repeat(100)) === 100, 'token estimate ~ chars/4')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
