/**
 * Grade cache tests (localStorage mock).
 * Run: node scripts/test-yuban-grade-cache.mjs
 */
import {
  buildGradeCacheKey,
  getCachedGrade,
  setCachedGrade,
  clearGradeCache,
} from '../src/yuban/grading/gradeCache.js'

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
}

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

clearGradeCache()

const key = buildGradeCacheKey({
  npcLine: '要喝水吗？',
  taskType: 'yes_no_response',
  expectedPatternHint: '要',
  studentReply: '要',
  hskLevel: 1,
})

const payload = {
  verdict: 'correct',
  taskType: 'yes_no_response',
  taskCompleted: true,
  voices: {
    teacher: { hanzi: '要。', pinyin: '', english: '', explanation: '' },
    friend: { hanzi: '要！', pinyin: '', english: '', label: 'natural' },
    bystander: { tip: '' },
  },
  alternatives: ['要', '是的'],
  mistakeLog: { shouldLog: false, type: 'none' },
}

setCachedGrade(key, payload)
const hit = getCachedGrade(key, '要')
assert(hit?.evaluation === 'correct', 'repeated grade returns from cache')

const key2 = buildGradeCacheKey({
  npcLine: '你好',
  taskType: 'greeting',
  expectedPatternHint: '',
  studentReply: '你好',
  hskLevel: 1,
})
setCachedGrade(key2, payload)

const raw = JSON.parse(localStorage.getItem('yuban_grade_cache_v1'))
for (let i = 0; i < 105; i += 1) {
  setCachedGrade(`k${i}`, payload)
}
const after = JSON.parse(localStorage.getItem('yuban_grade_cache_v1'))
assert(after.entries.length <= 100, 'cache max size enforced')

const oldKey = 'expired-test'
store.set(
  'yuban_grade_cache_v1',
  JSON.stringify({
    entries: [{ key: oldKey, at: Date.now() - 8 * 24 * 60 * 60 * 1000, grade: payload }],
  }),
)
assert(getCachedGrade(oldKey, '要') === null, 'cache expires old entry')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
