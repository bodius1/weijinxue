/**
 * Local deterministic grader tests (no LLM).
 * Run: node scripts/test-yuban-local-grader.mjs
 */
import { tryLocalGradeYubanTurn } from '../src/yuban/grading/localGrader.js'

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

function grade(npc, reply, extra = {}) {
  return tryLocalGradeYubanTurn({
    npcLine: npc,
    studentReply: reply,
    hskLevel: 1,
    ...extra,
  })
}

const g1 = grade('你好！', '你好吗')
assert(g1.handled && g1.normalizedGrade?.evaluation === 'correct', '你好 + 你好吗 → correct, local')

const g2 = grade('你要吃饭吗？', '是的')
assert(g2.handled && g2.normalizedGrade?.evaluation === 'correct', '你要吃饭吗 + 是的 → correct')

const g3 = grade('你要吃饭吗？', '我饿了')
assert(g3.handled && g3.normalizedGrade?.evaluation === 'correct', '你要吃饭吗 + 我饿了 → correct')

const g4 = grade('要喝水吗？', '我要和水')
assert(g4.handled && g4.normalizedGrade?.evaluation === 'almost', '要喝水吗 + 我要和水 → almost')
assert(g4.normalizedGrade?.likelyIntended === '喝', 'typo 和→喝')

const g5 = grade('你要去哪里？', '我想去我的房间')
assert(g5.handled && g5.normalizedGrade?.evaluation === 'correct', '你要去哪里 + 我想去我的房间 → correct')

const g6 = grade('你要吃什么？', '我想吃饭米饭')
assert(g6.handled && g6.normalizedGrade?.evaluation === 'almost', '你想吃饭米饭 → almost')

const g7 = grade('早上好！', '早')
assert(g7.handled && g7.normalizedGrade?.evaluation === 'correct', '早上好 + 早 → correct')

const g8 = grade('要喝茶吗？', '要')
assert(g8.handled && g8.normalizedGrade?.evaluation === 'correct', '要喝茶吗 + 要 → correct')
assert(
  g8.normalizedGrade?.alternatives?.some((a) => a.hanzi === '要'),
  'alternatives include 要 with hanzi',
)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
