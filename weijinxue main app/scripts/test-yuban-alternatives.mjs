/**
 * Alternatives normalization tests.
 * Run: node scripts/test-yuban-alternatives.mjs
 */
import { normalizeAlternatives } from '../src/yuban/grading/normalizeAlternatives.js'
import { normalizeGradingResponse } from '../src/yuban/conversation/gradingSchema.js'

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

const full = normalizeAlternatives([
  { hanzi: '要', pinyin: 'yào', english: 'want / yes', note: '' },
])
assert(full.length === 1 && full[0].hanzi === '要', 'full object alternatives render')

const strings = normalizeAlternatives(['要', '是的', ''])
assert(strings.length === 2 && strings[0].hanzi === '要' && strings[0].pinyin, 'string alternatives get pinyin')
assert(strings[1].english, 'string alternatives get english gloss')

const legacy = normalizeAlternatives([
  { text: '我要喝茶', translation: 'I want tea', pinyin: 'wǒ yào hē chá' },
])
assert(legacy[0].hanzi === '我要喝茶' && legacy[0].english.includes('tea'), 'text/translation legacy shape')

const empty = normalizeAlternatives([{}, { hanzi: '' }, null])
assert(empty.length === 0, 'empty alternatives filtered')

const viaSchema = normalizeGradingResponse(
  {
    verdict: 'correct',
    voices: { teacher: {}, friend: {}, bystander: {} },
    alternatives: ['要', { hanzi: '' }],
  },
  { studentReply: '要' },
)
assert(
  viaSchema.alternatives.length >= 1 && viaSchema.alternatives.every((a) => a.hanzi),
  'grading schema normalizes string alts and drops blanks',
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
