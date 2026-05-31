/**
 * Yǔbàn phrase IME tests.
 * Run: node scripts/test-yuban-phrase-ime.mjs
 */
import { buildYubanImeContext } from '../src/yuban/ime/yubanImeContext.js'
import { buildPhraseCandidates, splitDisplayCandidates } from '../src/yuban/ime/yubanPhraseCandidates.js'

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

const ctxEat = buildYubanImeContext(
  { hskLevel: 1 },
  { npcDialogueHanzi: '你要吃饭吗?', expectedHint: '要 / 不要', productionPrompt: 'Reply yes or no' },
)
const ctxDrink = buildYubanImeContext(
  { hskLevel: 1 },
  { npcDialogueHanzi: '要喝水吗?', expectedHint: '我要喝水', productionPrompt: 'Reply' },
)
const ctxHi = buildYubanImeContext(
  { hskLevel: 1 },
  { npcDialogueHanzi: '你好！', expectedHint: 'greeting', productionPrompt: 'Reply with a greeting' },
)

console.log('phrase top picks')
const ele = buildPhraseCandidates('ele', ctxEat, 1)
assert(ele[0]?.hanzi === '饿了', 'ele → 饿了')

const woele = buildPhraseCandidates('woele', ctxEat, 1)
assert(woele[0]?.hanzi === '我饿了', 'woele → 我饿了')

const nihaoma = buildPhraseCandidates('nihaoma', ctxHi, 1)
assert(nihaoma[0]?.hanzi === '你好吗', 'nihaoma → 你好吗')

const woyaoheshui = buildPhraseCandidates('woyaoheshui', ctxDrink, 1)
assert(woyaoheshui[0]?.hanzi === '我要喝水', 'woyaoheshui → 我要喝水')

const woeleEat = buildPhraseCandidates('woele', ctxEat, 1)
assert(woeleEat.some((p) => p.hanzi === '我饿了'), '要吃饭吗 context includes 我饿了')

const split = splitDisplayCandidates([], ele, 'ele')
assert(split.phraseCandidates.some((p) => p.hanzi === '饿了'), 'phrase row has 饿了')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
