/**
 * Context Journey progress store tests (Phase 3A).
 * Run: node test/contextProgressStore.test.js
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { timeDateContextPack } from '../src/journeys/data/contextPacks/timeDate.js'
import {
  STORAGE_KEY,
  __resetStorageForTests,
  createInitialContextProgress,
  getAllContextProgress,
  getContextProgress,
  ensureContextProgress,
  recordDrillAttempt,
  computeStageMastery,
  markStageComplete,
  resetContextProgress,
  resetAllContextProgress,
  getStorageAdapter,
} from '../src/journeys/engine/contextProgressStore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const storePath = join(__dirname, '../src/journeys/engine/contextProgressStore.js')

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

function setup() {
  __resetStorageForTests()
  resetAllContextProgress()
}

console.log('contextProgressStore')

setup()
{
  const doc = createInitialContextProgress(timeDateContextPack)
  assert(doc.contextId === 'time-date', 'creates initial progress for time-date')
  assert(
    doc.activeStageId === 'today-tomorrow-yesterday',
    'active stage is first stage',
  )
  assert(
    doc.unlockedStageIds.length === 1 &&
      doc.unlockedStageIds[0] === 'today-tomorrow-yesterday',
    'first stage is unlocked',
  )
}

setup()
ensureContextProgress(timeDateContextPack)
{
  const stageId = 'today-tomorrow-yesterday'
  recordDrillAttempt('time-date', stageId, 'd1', true)
  recordDrillAttempt('time-date', stageId, 'd2', false)
  const stats = getContextProgress('time-date')?.stageStats[stageId]
  assert(stats?.correctDrills === 1, 'recordDrillAttempt increments correct count')
  assert(stats?.incorrectDrills === 1, 'recordDrillAttempt increments incorrect count')
  assert(stats?.attemptedDrills === 2, 'attemptedDrills matches attempts')
}

setup()
ensureContextProgress(timeDateContextPack)
{
  const stageId = 'today-tomorrow-yesterday'
  recordDrillAttempt('time-date', stageId, 'dup', true)
  recordDrillAttempt('time-date', stageId, 'dup', true)
  const ids = getContextProgress('time-date')?.stageStats[stageId]?.completedDrillIds ?? []
  assert(ids.filter((x) => x === 'dup').length === 1, 'completedDrillIds does not duplicate')
}

setup()
ensureContextProgress(timeDateContextPack)
{
  const stageId = 'today-tomorrow-yesterday'
  const stats = getContextProgress('time-date')?.stageStats[stageId]
  const { masteryScore } = computeStageMastery(timeDateContextPack, stageId, stats)
  assert(masteryScore >= 0 && masteryScore <= 1, 'mastery score stays between 0 and 1')
  recordDrillAttempt('time-date', stageId, 'x', true)
  const after = getContextProgress('time-date')?.stageStats[stageId]
  const m2 = computeStageMastery(timeDateContextPack, stageId, after).masteryScore
  assert(m2 >= 0 && m2 <= 1, 'mastery score after attempt stays between 0 and 1')
}

setup()
ensureContextProgress(timeDateContextPack)
{
  markStageComplete('time-date', 'today-tomorrow-yesterday')
  const doc = getContextProgress('time-date')
  assert(
    doc?.completedStageIds.includes('today-tomorrow-yesterday'),
    'completing a stage marks it complete',
  )
  assert(
    doc?.unlockedStageIds.includes('weekdays'),
    'completing a stage unlocks the next stage',
  )
  assert(doc?.activeStageId === 'weekdays', 'activeStageId moves forward after completion')
}

setup()
{
  const storage = getStorageAdapter()
  storage.setItem(STORAGE_KEY, '{not valid json!!!')
  let root
  try {
    root = getAllContextProgress()
  } catch (e) {
    console.error(e)
    root = null
  }
  assert(root != null && root.version === 1, 'corrupt localStorage does not crash')
  assert(typeof root.contexts === 'object', 'corrupt localStorage yields contexts object')
}

setup()
ensureContextProgress(timeDateContextPack)
markStageComplete('time-date', 'today-tomorrow-yesterday')
{
  resetContextProgress('time-date')
  const doc = getContextProgress('time-date')
  assert(
    doc?.activeStageId === 'today-tomorrow-yesterday' &&
      doc.completedStageIds.length === 0,
    'resetContextProgress removes only one context progress',
  )
  const root = getAllContextProgress()
  assert(root.contexts['time-date'] != null, 'context entry still exists after single reset')
}

{
  const src = readFileSync(storePath, 'utf8')
  const forbidden = ['firebase', 'yuban', 'pinyinIme', 'sentenceIme']
  const lower = src.toLowerCase()
  const hits = forbidden.filter((f) => lower.includes(f))
  assert(hits.length === 0, 'no Firebase/Yǔbàn/IME imports in progress store')
  assert(STORAGE_KEY === 'weijinxue-context-progress-v1', 'uses expected storage key')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
