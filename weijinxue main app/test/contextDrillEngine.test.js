/**
 * Context drill engine tests (Phase 5).
 * Run: node test/contextDrillEngine.test.js
 */
import { DRILL_TYPES } from '../src/journeys/engine/contextPackSchema.js'
import {
  normalizeChineseAnswer,
  normalizePinyinAnswer,
  normalizeTextAnswer,
  checkDrillAnswer,
  getAcceptedAnswers,
  getNextIncompleteDrill,
} from '../src/journeys/engine/contextDrillEngine.js'

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

console.log('contextDrillEngine')

{
  const a = normalizeChineseAnswer('  明天早上。 ')
  const b = normalizeChineseAnswer('明天早上')
  assert(a === b, 'Chinese answer normalization ignores punctuation/spacing')
}

{
  assert(normalizePinyinAnswer('ZuoTian') === normalizePinyinAnswer('zuotian'), 'Pinyin accepts uppercase/lowercase')
}

{
  assert(
    normalizePinyinAnswer('nǚ') === normalizePinyinAnswer('nv'),
    'Pinyin normalization handles ü → v',
  )
  assert(
    normalizePinyinAnswer('u:') === normalizePinyinAnswer('v'),
    'Pinyin normalization handles u: → v',
  )
}

{
  const drill = {
    id: 'mc',
    type: DRILL_TYPES.MULTIPLE_CHOICE,
    prompt: 'x',
    choices: ['A', 'B'],
    answer: '今天',
  }
  assert(checkDrillAnswer(drill, '今天'), 'multiple-choice validates correct answer')
  assert(!checkDrillAnswer(drill, '明天'), 'multiple-choice rejects wrong choice')
}

{
  const drill = {
    id: 'tr',
    type: DRILL_TYPES.TRANSLATE_TO_CHINESE,
    prompt: 'tomorrow morning',
    answer: '明天早上',
    acceptedAnswers: ['明天早上！'],
  }
  assert(checkDrillAnswer(drill, '明天早上'), 'translate-to-chinese validates answer')
  assert(checkDrillAnswer(drill, '明天早上！'), 'translate-to-chinese validates acceptedAnswers')
}

{
  const drill = {
    id: 'rp',
    type: DRILL_TYPES.REPLY_SHORT,
    promptChinese: '你好',
    sampleAnswers: ['你好！', '早上好！'],
  }
  const accepted = getAcceptedAnswers(drill)
  assert(accepted.includes('你好！'), 'reply-short includes sampleAnswers')
  assert(checkDrillAnswer(drill, '早上好！'), 'reply-short validates sampleAnswers')
}

{
  const drill = {
    id: 'ar',
    type: DRILL_TYPES.ARRANGE_SENTENCE,
    prompt: 'x',
    answer: '今天早上。',
    acceptedAnswers: ['今天早上'],
  }
  assert(checkDrillAnswer(drill, ['今天', '早上', '。']), 'arrange-sentence validates array answer')
  assert(checkDrillAnswer(drill, '今天早上。'), 'arrange-sentence validates string answer')
}

{
  const stage = {
    id: 's',
    drills: [
      { id: 'a', type: DRILL_TYPES.MULTIPLE_CHOICE, prompt: '1', answer: 'x' },
      { id: 'b', type: DRILL_TYPES.MULTIPLE_CHOICE, prompt: '2', answer: 'y' },
    ],
  }
  const next = getNextIncompleteDrill(stage, ['a'])
  assert(next?.id === 'b', 'getNextIncompleteDrill skips completedDrillIds')
}

{
  const drill = { id: 'x', type: DRILL_TYPES.PINYIN_INPUT, prompt: 'p', answer: 'zuotian' }
  assert(!checkDrillAnswer(drill, 'mingtian'), 'incorrect pinyin returns false')
}

{
  assert(!checkDrillAnswer({ id: 'e', type: DRILL_TYPES.MULTIPLE_CHOICE, prompt: 'p', answer: 'x' }, ''), 'empty answer returns false')
  assert(!checkDrillAnswer({ id: 'e', type: DRILL_TYPES.MULTIPLE_CHOICE, prompt: 'p', answer: 'x' }, '   '), 'whitespace-only returns false')
}

{
  assert(normalizeTextAnswer('  hello   world ') === 'hello world', 'normalizeTextAnswer collapses spaces')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
