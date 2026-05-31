/**
 * Yǔbàn IME candidate ranking tests.
 * Run: node scripts/test-yuban-ime-ranking.mjs
 */
import { buildYubanImeContext } from '../src/yuban/ime/yubanImeContext.js'
import { extractExpectedAnswerTokens } from '../src/yuban/ime/extractExpectedAnswerTokens.js'
import {
  rankYubanCandidates,
  scoreYubanCandidate,
} from '../src/yuban/ime/rankYubanCandidates.js'
import { classifyCandidateTypes } from '../src/yuban/ime/candidateTypes.js'

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

/** @param {string} hanzi @param {string} pinyin */
function entry(hanzi, pinyin) {
  return { simplified: hanzi, pinyin, english: ['test'] }
}

function rankWithHint(candidates, input, hint, extra = {}) {
  const ctx = buildYubanImeContext(
    { hskLevel: 1 },
    {
      expectedHint: hint,
      productionPrompt: extra.productionPrompt ?? '',
      npcDialogueHanzi: extra.npcDialogueHanzi ?? '',
    },
  )
  return rankYubanCandidates(candidates, input, ctx)
}

const yaoPrefixNoise = [
  entry('要不', 'yào bù'),
  entry('邀请', 'yāo qǐng'),
  entry('要求', 'yāo qiú'),
  entry('要是', 'yào shì'),
  entry('要', 'yào'),
]

console.log('extractExpectedAnswerTokens')
const tokens = extractExpectedAnswerTokens('Reply with either "要" or "不要"')
assert(tokens.includes('要'), 'parses 要 from hint')
assert(tokens.includes('不要'), 'parses 不要 from hint')

console.log('\nTest 1: yao + 要/不要 hint')
const ranked1 = rankWithHint(yaoPrefixNoise, 'yao', 'Reply with either "要" or "不要"')
assert(ranked1[0]?.simplified === '要', '要 is #1 for yao')
const yaoPos = ranked1.findIndex((e) => e.simplified === '要')
const badBeforeYao = ['要不', '邀请', '要求', '要是'].some((h) => {
  const i = ranked1.findIndex((e) => e.simplified === h)
  return i >= 0 && i < yaoPos
})
assert(!badBeforeYao, '要不/邀请/要求/要是 do not rank above 要')

console.log('\nTest 2: buyao → 不要')
const buyaoList = [
  entry('要不', 'yào bù'),
  entry('要', 'yào'),
  entry('不要', 'bù yào'),
  entry('邀请', 'yāo qǐng'),
]
const ranked2 = rankWithHint(buyaoList, 'buyao', 'Reply with either "要" or "不要"')
assert(ranked2[0]?.simplified === '不要', '不要 is #1 for buyao')

console.log('\nTest 3: zao greeting')
const zaoList = [
  entry('遭', 'zāo'),
  entry('糟', 'zāo'),
  entry('早上好', 'zǎo shang hǎo'),
  entry('早上', 'zǎo shang'),
  entry('早', 'zǎo'),
]
const ranked3 = rankWithHint(zaoList, 'zao', '早上好 / 早', {
  npcDialogueHanzi: '早上好！',
  productionPrompt: 'Reply with a greeting.',
})
assert(ranked3[0]?.simplified === '早', '早 is #1 for zao')
const zaoIdx = ranked3.findIndex((e) => e.simplified === '早')
const zaoHaoIdx = ranked3.findIndex((e) => e.simplified === '早上好')
assert(zaoHaoIdx < 0 || zaoIdx < zaoHaoIdx, '早上好 not before 早')

console.log('\nTest 4: yao + gym location hint')
const ranked4 = rankWithHint(yaoPrefixNoise, 'yao', 'Use 要 and 去', {
  productionPrompt: 'Tell 李姐 you want to go to the gym.',
})
assert(ranked4[0]?.simplified === '要', '要 is #1 for location task yao')

console.log('\nTest 5: chi before 吃饭')
const chiList = [
  entry('吃饭', 'chī fàn'),
  entry('吃东西', 'chī dōng xi'),
  entry('吃', 'chī'),
]
const ranked5 = rankWithHint(chiList, 'chi', '我想吃米饭', {
  productionPrompt: 'What do you want to eat?',
})
assert(ranked5[0]?.simplified === '吃', '吃 is #1 for chi')
const chiIdx = ranked5.findIndex((e) => e.simplified === '吃')
const fanIdx = ranked5.findIndex((e) => e.simplified === '吃饭')
assert(fanIdx < 0 || chiIdx < fanIdx, '吃饭 after 吃 unless only 吃饭 expected')

console.log('\nTest 6: woyao → 我要')
const woYaoList = [
  entry('我', 'wǒ'),
  entry('要', 'yào'),
  entry('我要', 'wǒ yào'),
  entry('我要吃', 'wǒ yào chī'),
]
const ranked6 = rankWithHint(woYaoList, 'woyao', '我要', {
  productionPrompt: 'Say you want something.',
})
assert(ranked6[0]?.simplified === '我要', '我要 is #1 for woyao')

console.log('\nCandidate classification (yao → 要)')
const ctxYao = buildYubanImeContext({ hskLevel: 1 }, {
  expectedHint: 'Reply with either "要" or "不要"',
})
const yaoEntry = entry('要', 'yào')
const yaoBuEntry = entry('要不', 'yào bù')
const yaoTypes = classifyCandidateTypes(yaoEntry, 'yao', ctxYao)
const buTypes = classifyCandidateTypes(yaoBuEntry, 'yao', ctxYao)
assert(yaoTypes.includes('exact_syllable_match'), '要 is exact_syllable_match')
assert(yaoTypes.includes('expected_answer_match'), '要 is expected_answer_match')
assert(buTypes.includes('prefix_phrase_match'), '要不 is prefix_phrase_match')
assert(scoreYubanCandidate(yaoEntry, 'yao', ctxYao) > scoreYubanCandidate(yaoBuEntry, 'yao', ctxYao), '要 scores higher than 要不')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
