/**
 * Story beat anti-repetition guard tests.
 * Run: node scripts/test-story-beat-guards.mjs
 */
import { isDuplicateBeat, pickFallbackBeat } from '../src/yuban/conversation/storyBeatGuards.js'

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

const recentGym = [
  {
    dialogueHanzi: '你要去哪里?',
    productionPrompt: 'Tell them you want to go to the gym using 去.',
    expectedPatternHint: '去 + 健身房',
    evaluation: 'correct',
  },
]

const repeatGymBeat = {
  dialogue: { hanzi: '你要去哪里?', pinyin: '', english: '' },
  productionPrompt: 'Say you want to go to the gym.',
  expectedPatternHint: '去健身房',
  narration: '',
  speaker: { id: 'x', chineseName: '李姐', pinyinName: '', role: 'guide', isNew: false },
  newVocab: [],
  storyLogEntry: '',
}

assert(isDuplicateBeat(repeatGymBeat, recentGym), 'gym + where question repeats after success')

const fallback = pickFallbackBeat(1, recentGym)
assert(
  !`${fallback.dialogue.hanzi}${fallback.productionPrompt}${fallback.expectedPatternHint}`.includes(
    '健身房',
  ) || fallback.dialogue.hanzi !== '你要去哪里?',
  'fallback avoids immediate gym repeat',
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
