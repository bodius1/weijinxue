/**
 * Yǔbàn grading schema tests (normalization + expected verdict mapping).
 * Run: node scripts/test-yuban-grading.mjs
 */
import {
  normalizeGradingResponse,
  verdictToEvaluation,
  applyRecoveryText,
  buildRecoveryMistakeEntry,
} from '../src/yuban/conversation/gradingSchema.js'
import { applyGradingOverrides } from '../src/yuban/conversation/gradingOverrides.js'

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

/** Simulated AI responses for test-case expectations */
const FIXTURES = {
  test1_eat: {
    verdict: 'correct',
    taskType: 'yes_no_response',
    taskCompleted: true,
    detectedIntent: 'affirmative',
    voices: {
      teacher: { hanzi: '吃。', pinyin: 'Chī.', english: 'Yes, I will eat.', explanation: '' },
      friend: { hanzi: '吃。', pinyin: 'Chī.', english: 'Yeah.', label: 'casual' },
      bystander: { tip: 'A single verb can answer 吃饭吗?' },
    },
    alternatives: [{ hanzi: '吃。', note: 'simplest' }],
    mistakeLog: { shouldLog: false, type: 'none' },
  },
  test5_dui_typo: {
    verdict: 'almost',
    taskType: 'yes_no_response',
    taskCompleted: false,
    likelyTypo: true,
    studentWrote: '堆',
    likelyIntended: '对',
    allowRecoveryButton: true,
    recoveryButtonText: 'I meant 对',
    voices: {
      teacher: {
        explanation: 'Almost — you may have meant 对. 堆 means pile.',
        hanzi: '是的，我要吃饭。',
        pinyin: 'Shì de, wǒ yào chī fàn.',
        english: 'Yes, I will eat.',
      },
      friend: { hanzi: '吃。', label: 'casual' },
      bystander: { tip: 'Answering with 吃 or 对 both work here.' },
    },
    mistakeLog: { shouldLog: true, type: 'character_selection' },
  },
  test7_off_task_greeting: {
    verdict: 'off_task',
    taskType: 'greeting',
    taskCompleted: false,
    naturalness: 'off_task',
    voices: {
      teacher: {
        hanzi: '谢谢！',
        pinyin: 'Xièxie!',
        english: 'Thank you!',
        explanation: 'This task only needed a greeting.',
      },
      friend: {
        hanzi: '你知道哪里有好吃的吗？',
        label: 'above_current_level',
        english: 'Do you know where there is good food?',
      },
      bystander: { tip: 'At a shop door, 谢谢 is enough.' },
    },
    mistakeLog: { shouldLog: true, type: 'off_task' },
  },
}

console.log('verdictToEvaluation')
assert(verdictToEvaluation('correct') === 'correct', 'correct → correct')
assert(verdictToEvaluation('off_task') === 'off_task', 'off_task → off_task')
assert(verdictToEvaluation('incorrect') === 'wrong', 'incorrect → wrong')

console.log('\nnormalizeGradingResponse (new schema)')
const n1 = normalizeGradingResponse(FIXTURES.test1_eat, { studentReply: '吃' })
assert(n1.evaluation === 'correct', 'Test 1: 吃 → correct')
assert(n1.taskCompleted === true, 'Test 1: taskCompleted')

const n5 = normalizeGradingResponse(FIXTURES.test5_dui_typo, { studentReply: '堆' })
assert(n5.evaluation === 'almost', 'Test 5: 堆 → almost')
assert(n5.allowRecoveryButton === true, 'Test 5: recovery button')
assert(n5.likelyIntended === '对', 'Test 5: likelyIntended 对')
assert(n5.voices.laoshi.label === '老师 Lǎoshī', 'Test 5: teacher voice mapped')

const n7 = normalizeGradingResponse(FIXTURES.test7_off_task_greeting, {
  studentReply: '谢谢！我很高兴在里中国！',
})
assert(n7.evaluation === 'off_task', 'Test 7: long off-task → off_task')
assert(n7.mistakeRecord?.type === 'off_task', 'Test 7: mistake logged')

console.log('\napplyRecoveryText')
assert(applyRecoveryText('堆', '堆', '对') === '对', 'replace 堆 → 对')
assert(applyRecoveryText('', '堆', '对') === '对', 'empty original → 对')

console.log('\nrecovery mistake entry')
const entry = buildRecoveryMistakeEntry(
  { dialogue: { hanzi: '吃饭吗?' } },
  { hskLevel: 1 },
  { wrote: '堆', intended: '对', taskType: 'yes_no_response' },
)
assert(entry.type === 'character_selection_mistake', 'recovery entry type')
assert(entry.intended === '对', 'recovery entry intended')

console.log('\nlegacy schema still works')
const legacy = normalizeGradingResponse(
  {
    evaluation: 'correct',
    voices: {
      laoshi: { label: '老师', hanzi: '好', note: 'ok' },
      pengyou: { label: '朋友', hanzi: '好' },
      luren: { label: '路人', note: 'tip' },
    },
  },
  { studentReply: '好' },
)
assert(legacy.evaluation === 'correct', 'legacy correct')

console.log('\napplyGradingOverrides')
const turnWhere = {
  dialogue: { hanzi: '你要去哪里?', pinyin: 'Nǐ yào qù nǎlǐ?', english: 'Where do you want to go?' },
  productionPrompt: 'Use 去 and tell 李姐 you want to go to your room.',
  expectedPatternHint: '我要去房间 / 去 + location',
}
const almostRoom = normalizeGradingResponse(
  {
    verdict: 'almost',
    taskCompleted: false,
    voices: {
      teacher: { explanation: 'Use 要 instead of 想.', hanzi: '我要去我的房间。' },
      friend: { hanzi: '我要去我的房间。', label: 'natural' },
      bystander: { tip: '' },
    },
    mistakeLog: { shouldLog: false, type: 'none' },
  },
  { studentReply: '我想去我的房间' },
)
const roomGraded = applyGradingOverrides(turnWhere, '我想去我的房间', almostRoom)
assert(roomGraded.evaluation === 'correct', '我想去我的房间 → correct (location + 去)')

const turnMorning = {
  dialogue: { hanzi: '早上好！', pinyin: 'Zǎoshang hǎo!', english: 'Good morning!' },
  productionPrompt: 'Reply with a greeting.',
  expectedPatternHint: '早上好',
}
const almostZao = normalizeGradingResponse(
  {
    verdict: 'almost',
    taskCompleted: false,
    voices: {
      teacher: { explanation: 'Use the complete greeting 早上好.', hanzi: '早上好' },
      friend: { hanzi: '早上好', label: 'natural' },
      bystander: { tip: '' },
    },
    mistakeLog: { shouldLog: false, type: 'none' },
  },
  { studentReply: '早' },
)
const zaoGraded = applyGradingOverrides(turnMorning, '早', almostZao)
assert(zaoGraded.evaluation === 'correct', '早 → correct (short greeting)')

const turnEat = {
  dialogue: { hanzi: '你要吃什么?', pinyin: '', english: '' },
  productionPrompt: 'Say what you want to eat.',
  expectedPatternHint: '我想吃米饭',
}
const wrongEat = normalizeGradingResponse(
  {
    verdict: 'almost',
    taskCompleted: false,
    voices: {
      teacher: { explanation: 'Say 我想吃米饭 — 吃饭米饭 is not natural.', hanzi: '我想吃米饭。' },
      friend: { hanzi: '我想吃米饭', label: 'natural' },
      bystander: { tip: '' },
    },
    mistakeLog: { shouldLog: true, type: 'word_order' },
  },
  { studentReply: '我想吃饭米饭' },
)
const eatGraded = applyGradingOverrides(turnEat, '我想吃饭米饭', wrongEat)
assert(eatGraded.evaluation === 'almost', '吃饭米饭 stays almost (structural error)')

const turnHi = {
  dialogue: { hanzi: '你好！', pinyin: '', english: 'Hello!' },
  productionPrompt: 'Reply with a greeting.',
  expectedPatternHint: '你好',
}
const almostNihaoMa = normalizeGradingResponse(
  {
    verdict: 'almost',
    taskCompleted: false,
    voices: {
      teacher: { explanation: 'Say 你好 only.', hanzi: '你好' },
      friend: { hanzi: '你好', label: 'natural' },
      bystander: { tip: '' },
    },
    mistakeLog: { shouldLog: false, type: 'none' },
  },
  { studentReply: '你好吗' },
)
assert(
  applyGradingOverrides(turnHi, '你好吗', almostNihaoMa, { hskLevel: 1 }).evaluation === 'correct',
  '你好吗 → correct (greeting)',
)

const turnEatYes = {
  dialogue: { hanzi: '你要吃饭吗?', pinyin: '', english: '' },
  productionPrompt: 'Reply with 要 or 不要',
  expectedPatternHint: '要 / 不要',
}
const almostShide = normalizeGradingResponse(
  {
    verdict: 'almost',
    voices: {
      teacher: { explanation: 'Use 要', hanzi: '要' },
      friend: { hanzi: '要', label: 'natural' },
      bystander: { tip: '' },
    },
    mistakeLog: { shouldLog: false, type: 'none' },
  },
  { studentReply: '是的' },
)
assert(
  applyGradingOverrides(turnEatYes, '是的', almostShide, { hskLevel: 1 }).evaluation === 'correct',
  '是的 for 吃饭吗 → correct',
)

const turnDrink = {
  dialogue: { hanzi: '要喝水吗?', pinyin: '', english: '' },
  productionPrompt: 'Say you want water',
  expectedPatternHint: '我要喝水',
}
const almostHe = normalizeGradingResponse(
  {
    verdict: 'almost',
    voices: {
      teacher: { explanation: 'wrong', hanzi: '我要水' },
      friend: { hanzi: '', label: 'natural' },
      bystander: { tip: '' },
    },
    mistakeLog: { shouldLog: true, type: 'character_selection' },
  },
  { studentReply: '我要和水' },
)
const heGraded = applyGradingOverrides(turnDrink, '我要和水', almostHe, { hskLevel: 1 })
assert(heGraded.evaluation === 'almost', '我要和水 → almost')
assert(/喝水|喝/.test(heGraded.voices.laoshi.note ?? ''), 'correction mentions 喝/喝水')

const hungry = applyGradingOverrides(
  turnEatYes,
  '我饿了',
  normalizeGradingResponse({ verdict: 'almost', voices: { teacher: {}, friend: {}, bystander: {} } }, {
    studentReply: '我饿了',
  }),
  { hskLevel: 1 },
)
assert(hungry.evaluation === 'correct', '我饿了 → correct for 吃饭吗')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
