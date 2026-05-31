/**
 * Local-first Context Journey progress (Phase 3A).
 * All reads/writes go through this module — UI and hooks must not touch localStorage directly.
 */
import { getContextPackById } from '../data/contextPacks/index.js'
import { getFirstStage, getNextStage, getStageById } from './contextPackSchema.js'

export const STORAGE_KEY = 'weijinxue-context-progress-v1'

const PROGRESS_VERSION = 1

/** @typedef {Object} StageStats
 * @property {number} correctDrills
 * @property {number} incorrectDrills
 * @property {number} attemptedDrills
 * @property {string[]} completedDrillIds
 * @property {number} aiTurnsCompleted
 * @property {number} masteryScore
 * @property {number | null} lastPracticedAt
 * @property {number | null} updatedAt
 */

/** @typedef {Object} ContextProgressDoc
 * @property {string} contextId
 * @property {string} activeStageId
 * @property {string[]} unlockedStageIds
 * @property {string[]} completedStageIds
 * @property {Record<string, StageStats>} stageStats
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/** @typedef {Object} ProgressRoot
 * @property {number} version
 * @property {Record<string, ContextProgressDoc>} contexts
 * @property {number} updatedAt
 */

/** @type {Map<string, string> | null} */
let memoryStorage = null

/**
 * Browser localStorage or in-memory fallback (Node/tests).
 * @returns {{ getItem: (k: string) => string | null, setItem: (k: string, v: string) => void, removeItem: (k: string) => void }}
 */
export function getStorageAdapter() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const ls = globalThis.localStorage
      ls.getItem('')
      return ls
    }
  } catch {
    /* private mode / disabled */
  }
  if (!memoryStorage) memoryStorage = new Map()
  return {
    getItem: (key) => memoryStorage.get(key) ?? null,
    setItem: (key, value) => {
      memoryStorage.set(key, value)
    },
    removeItem: (key) => {
      memoryStorage.delete(key)
    },
  }
}

/** For tests only — clears in-memory backing store. */
export function __resetStorageForTests() {
  memoryStorage = null
}

/**
 * @param {number} [ts]
 */
function nowMs(ts) {
  return typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now()
}

/**
 * @param {string[]} list
 * @param {string} id
 * @returns {string[]}
 */
function uniqueAppend(list, id) {
  if (!id || list.includes(id)) return [...list]
  return [...list, id]
}

/**
 * @param {unknown} raw
 * @returns {StageStats}
 */
function normalizeStageStats(raw) {
  const s = raw && typeof raw === 'object' ? /** @type {StageStats} */ (raw) : {}
  const correct = Math.max(0, Number(s.correctDrills) || 0)
  const incorrect = Math.max(0, Number(s.incorrectDrills) || 0)
  const attempted = Math.max(
    correct + incorrect,
    Number(s.attemptedDrills) || 0,
  )
  const completedDrillIds = Array.isArray(s.completedDrillIds)
    ? [...new Set(s.completedDrillIds.filter((x) => typeof x === 'string'))]
    : []
  return {
    correctDrills: correct,
    incorrectDrills: incorrect,
    attemptedDrills: attempted,
    completedDrillIds,
    aiTurnsCompleted: Math.max(0, Number(s.aiTurnsCompleted) || 0),
    masteryScore: clamp01(Number(s.masteryScore) || 0),
    lastPracticedAt:
      s.lastPracticedAt != null && Number.isFinite(Number(s.lastPracticedAt))
        ? Number(s.lastPracticedAt)
        : null,
    updatedAt:
      s.updatedAt != null && Number.isFinite(Number(s.updatedAt))
        ? Number(s.updatedAt)
        : null,
  }
}

/**
 * @param {string} stageId
 * @param {number} [ts]
 * @returns {StageStats}
 */
export function createEmptyStageStats(stageId, ts) {
  const t = nowMs(ts)
  return {
    correctDrills: 0,
    incorrectDrills: 0,
    attemptedDrills: 0,
    completedDrillIds: [],
    aiTurnsCompleted: 0,
    masteryScore: 0,
    lastPracticedAt: null,
    updatedAt: t,
  }
}

/**
 * @param {import('./contextPackSchema.js').ContextPack} contextPack
 * @param {number} [ts]
 * @returns {ContextProgressDoc}
 */
export function createInitialContextProgress(contextPack, ts) {
  const t = nowMs(ts)
  const first = getFirstStage(contextPack)
  /** @type {Record<string, StageStats>} */
  const stageStats = {}
  for (const stage of contextPack.stages) {
    stageStats[stage.id] = createEmptyStageStats(stage.id, t)
  }
  return {
    contextId: contextPack.id,
    activeStageId: first.id,
    unlockedStageIds: [first.id],
    completedStageIds: [],
    stageStats,
    createdAt: t,
    updatedAt: t,
  }
}

/**
 * @param {unknown} raw
 * @returns {ProgressRoot}
 */
export function normalizeProgressRoot(raw) {
  if (!raw || typeof raw !== 'object') {
    return { version: PROGRESS_VERSION, contexts: {}, updatedAt: Date.now() }
  }
  const r = /** @type {ProgressRoot} */ (raw)
  const contexts = r.contexts && typeof r.contexts === 'object' ? r.contexts : {}
  /** @type {Record<string, ContextProgressDoc>} */
  const normalizedContexts = {}
  for (const [key, val] of Object.entries(contexts)) {
    if (!val || typeof val !== 'object') continue
    const c = /** @type {ContextProgressDoc} */ (val)
    const contextId = typeof c.contextId === 'string' ? c.contextId : key
    const stageStatsRaw = c.stageStats && typeof c.stageStats === 'object' ? c.stageStats : {}
    /** @type {Record<string, StageStats>} */
    const stageStats = {}
    for (const [sid, st] of Object.entries(stageStatsRaw)) {
      stageStats[sid] = normalizeStageStats(st)
    }
    normalizedContexts[contextId] = {
      contextId,
      activeStageId: typeof c.activeStageId === 'string' ? c.activeStageId : '',
      unlockedStageIds: Array.isArray(c.unlockedStageIds)
        ? [...new Set(c.unlockedStageIds.filter((x) => typeof x === 'string'))]
        : [],
      completedStageIds: Array.isArray(c.completedStageIds)
        ? [...new Set(c.completedStageIds.filter((x) => typeof x === 'string'))]
        : [],
      stageStats,
      createdAt: Number.isFinite(Number(c.createdAt)) ? Number(c.createdAt) : Date.now(),
      updatedAt: Number.isFinite(Number(c.updatedAt)) ? Number(c.updatedAt) : Date.now(),
    }
  }
  return {
    version: Number(r.version) === PROGRESS_VERSION ? PROGRESS_VERSION : PROGRESS_VERSION,
    contexts: normalizedContexts,
    updatedAt: Number.isFinite(Number(r.updatedAt)) ? Number(r.updatedAt) : Date.now(),
  }
}

/**
 * @returns {ProgressRoot}
 */
export function getAllContextProgress() {
  const storage = getStorageAdapter()
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return normalizeProgressRoot(null)
    return normalizeProgressRoot(JSON.parse(raw))
  } catch {
    return normalizeProgressRoot(null)
  }
}

/**
 * @param {ProgressRoot} progressRoot
 */
export function saveAllContextProgress(progressRoot) {
  const storage = getStorageAdapter()
  const normalized = normalizeProgressRoot(progressRoot)
  normalized.updatedAt = Date.now()
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    /* quota / private mode */
  }
  return normalized
}

/**
 * @param {string} contextId
 * @returns {ContextProgressDoc | null}
 */
export function getContextProgress(contextId) {
  const root = getAllContextProgress()
  return root.contexts[contextId] ?? null
}

/**
 * @param {import('./contextPackSchema.js').ContextPack | string} contextPackOrContextId
 * @returns {ContextProgressDoc}
 */
export function ensureContextProgress(contextPackOrContextId) {
  const pack =
    typeof contextPackOrContextId === 'string'
      ? getContextPackById(contextPackOrContextId)
      : contextPackOrContextId
  if (!pack) {
    throw new Error(`Unknown context pack: ${contextPackOrContextId}`)
  }
  const root = getAllContextProgress()
  let doc = root.contexts[pack.id]
  if (!doc) {
    doc = createInitialContextProgress(pack)
    root.contexts[pack.id] = doc
    saveAllContextProgress(root)
  }
  return cloneContextProgressDoc(doc)
}

/**
 * @param {ContextProgressDoc} doc
 * @returns {ContextProgressDoc}
 */
function cloneContextProgressDoc(doc) {
  const stageStats = {}
  for (const [sid, st] of Object.entries(doc.stageStats ?? {})) {
    stageStats[sid] = { ...st, completedDrillIds: [...(st.completedDrillIds ?? [])] }
  }
  return {
    ...doc,
    unlockedStageIds: [...doc.unlockedStageIds],
    completedStageIds: [...doc.completedStageIds],
    stageStats,
  }
}

/**
 * @param {number} n
 */
function clamp01(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/**
 * @param {import('./contextPackSchema.js').ContextPack} contextPack
 * @param {string} stageId
 * @param {StageStats} stageStats
 */
export function computeStageMastery(contextPack, stageId, stageStats) {
  const stage = getStageById(contextPack, stageId)
  if (!stage) {
    return {
      masteryScore: 0,
      met: false,
      drillMet: false,
      aiMet: false,
      accuracy: 0,
      requiredCorrectDrills: 0,
      requiredAiTurns: 0,
    }
  }
  const mastery = stage.mastery ?? { requiredCorrectDrills: 0 }
  const requiredCorrect = Math.max(0, Number(mastery.requiredCorrectDrills) || 0)
  const requiredAi = Math.max(0, Number(mastery.requiredAiTurns) || 0)
  const minAccuracy = mastery.minAccuracy != null ? clamp01(mastery.minAccuracy) : 0.8

  const correct = stageStats.correctDrills ?? 0
  const incorrect = stageStats.incorrectDrills ?? 0
  const attempted = Math.max(stageStats.attemptedDrills ?? 0, correct + incorrect)
  const accuracy = attempted > 0 ? correct / attempted : 0

  const drillMet = correct >= requiredCorrect && accuracy >= minAccuracy
  const aiMet = requiredAi === 0 || (stageStats.aiTurnsCompleted ?? 0) >= requiredAi
  const met = drillMet && aiMet

  const drillRatio = requiredCorrect > 0 ? Math.min(1, correct / requiredCorrect) : 1
  const accRatio = minAccuracy > 0 ? Math.min(1, accuracy / minAccuracy) : 1
  const aiRatio = requiredAi > 0 ? Math.min(1, (stageStats.aiTurnsCompleted ?? 0) / requiredAi) : 1

  const masteryScore = clamp01(
    requiredAi > 0
      ? drillRatio * 0.45 + accRatio * 0.35 + aiRatio * 0.2
      : drillRatio * 0.55 + accRatio * 0.45,
  )

  return {
    masteryScore,
    met,
    drillMet,
    aiMet,
    accuracy,
    requiredCorrectDrills: requiredCorrect,
    requiredAiTurns: requiredAi,
  }
}

/**
 * @param {import('./contextPackSchema.js').ContextPack} pack
 * @param {ContextProgressDoc} doc
 * @param {string} stageId
 */
function stageOrderIndex(pack, stageId) {
  return pack.stages.findIndex((s) => s.id === stageId)
}

/**
 * @param {ProgressRoot} root
 * @param {import('./contextPackSchema.js').ContextPack} pack
 * @param {string} completedStageId
 * @returns {ProgressRoot}
 */
function applyStageCompletion(root, pack, completedStageId) {
  const doc = root.contexts[pack.id]
  if (!doc) return root

  const t = Date.now()
  const next = getNextStage(pack, completedStageId)
  const completedIdx = stageOrderIndex(pack, completedStageId)
  const activeIdx = stageOrderIndex(pack, doc.activeStageId)

  let unlockedStageIds = [...doc.unlockedStageIds]
  let completedStageIds = uniqueAppend(doc.completedStageIds, completedStageId)
  if (next) {
    unlockedStageIds = uniqueAppend(unlockedStageIds, next.id)
  }

  let activeStageId = doc.activeStageId
  if (next && activeIdx <= completedIdx) {
    activeStageId = next.id
  }

  const stageStats = { ...doc.stageStats }
  const prev = stageStats[completedStageId] ?? createEmptyStageStats(completedStageId, t)
  const mastery = computeStageMastery(pack, completedStageId, prev)
  stageStats[completedStageId] = {
    ...prev,
    masteryScore: mastery.masteryScore,
    updatedAt: t,
  }

  return {
    ...root,
    contexts: {
      ...root.contexts,
      [pack.id]: {
        ...doc,
        activeStageId,
        unlockedStageIds,
        completedStageIds,
        stageStats,
        updatedAt: t,
      },
    },
    updatedAt: t,
  }
}

/**
 * @param {string} contextId
 * @param {string} stageId
 * @param {Partial<StageStats>} patch
 */
export function updateStageProgress(contextId, stageId, patch) {
  const pack = getContextPackById(contextId)
  if (!pack) throw new Error(`Unknown context: ${contextId}`)

  const root = getAllContextProgress()
  let doc = root.contexts[contextId]
  if (!doc) {
    doc = createInitialContextProgress(pack)
  }

  const t = Date.now()
  const prev = doc.stageStats[stageId] ?? createEmptyStageStats(stageId, t)
  const merged = normalizeStageStats({ ...prev, ...patch, updatedAt: t })
  merged.lastPracticedAt = patch.lastPracticedAt ?? t
  merged.masteryScore = computeStageMastery(pack, stageId, merged).masteryScore

  const nextRoot = {
    ...root,
    contexts: {
      ...root.contexts,
      [contextId]: {
        ...doc,
        stageStats: { ...doc.stageStats, [stageId]: merged },
        updatedAt: t,
      },
    },
    updatedAt: t,
  }
  saveAllContextProgress(nextRoot)
  return nextRoot.contexts[contextId]
}

/**
 * @param {string} contextId
 * @param {string} stageId
 * @param {string} drillId
 * @param {boolean} wasCorrect
 */
export function recordDrillAttempt(contextId, stageId, drillId, wasCorrect) {
  const pack = getContextPackById(contextId)
  if (!pack) throw new Error(`Unknown context: ${contextId}`)

  const root = getAllContextProgress()
  let doc = root.contexts[contextId] ?? createInitialContextProgress(pack)
  const t = Date.now()
  const prev = doc.stageStats[stageId] ?? createEmptyStageStats(stageId, t)

  const correctDrills = prev.correctDrills + (wasCorrect ? 1 : 0)
  const incorrectDrills = prev.incorrectDrills + (wasCorrect ? 0 : 1)
  const attemptedDrills = correctDrills + incorrectDrills
  const completedDrillIds =
    wasCorrect && drillId ? uniqueAppend(prev.completedDrillIds, drillId) : [...prev.completedDrillIds]

  const nextStats = normalizeStageStats({
    ...prev,
    correctDrills,
    incorrectDrills,
    attemptedDrills,
    completedDrillIds,
    lastPracticedAt: t,
    updatedAt: t,
  })
  nextStats.masteryScore = computeStageMastery(pack, stageId, nextStats).masteryScore

  let nextRoot = {
    ...root,
    contexts: {
      ...root.contexts,
      [contextId]: {
        ...doc,
        stageStats: { ...doc.stageStats, [stageId]: nextStats },
        updatedAt: t,
      },
    },
    updatedAt: t,
  }

  const { met } = computeStageMastery(pack, stageId, nextStats)
  if (met && !doc.completedStageIds.includes(stageId)) {
    nextRoot = applyStageCompletion(nextRoot, pack, stageId)
  }

  saveAllContextProgress(nextRoot)
  return nextRoot.contexts[contextId]
}

/**
 * @param {string} contextId
 * @param {string} stageId
 * @param {{ success?: boolean, count?: number }} [options]
 */
export function recordAiTurn(contextId, stageId, options = {}) {
  const pack = getContextPackById(contextId)
  if (!pack) throw new Error(`Unknown context: ${contextId}`)

  const success = options.success !== false
  const count = Math.max(1, Number(options.count) || 1)

  const root = getAllContextProgress()
  let doc = root.contexts[contextId] ?? createInitialContextProgress(pack)
  const t = Date.now()
  const prev = doc.stageStats[stageId] ?? createEmptyStageStats(stageId, t)

  const aiTurnsCompleted = prev.aiTurnsCompleted + (success ? count : 0)
  const nextStats = normalizeStageStats({
    ...prev,
    aiTurnsCompleted,
    lastPracticedAt: t,
    updatedAt: t,
  })
  nextStats.masteryScore = computeStageMastery(pack, stageId, nextStats).masteryScore

  let nextRoot = {
    ...root,
    contexts: {
      ...root.contexts,
      [contextId]: {
        ...doc,
        stageStats: { ...doc.stageStats, [stageId]: nextStats },
        updatedAt: t,
      },
    },
    updatedAt: t,
  }

  const { met } = computeStageMastery(pack, stageId, nextStats)
  if (met && !doc.completedStageIds.includes(stageId)) {
    nextRoot = applyStageCompletion(nextRoot, pack, stageId)
  }

  saveAllContextProgress(nextRoot)
  return nextRoot.contexts[contextId]
}

/**
 * @param {string} contextId
 * @param {string} stageId
 */
export function markStageComplete(contextId, stageId) {
  const pack = getContextPackById(contextId)
  if (!pack) throw new Error(`Unknown context: ${contextId}`)

  const root = getAllContextProgress()
  const doc = root.contexts[contextId] ?? createInitialContextProgress(pack)
  const nextRoot = applyStageCompletion(
    { ...root, contexts: { ...root.contexts, [contextId]: doc } },
    pack,
    stageId,
  )
  saveAllContextProgress(nextRoot)
  return nextRoot.contexts[contextId]
}

/**
 * @param {string} contextId
 * @param {string} stageId
 */
export function unlockNextStage(contextId, stageId) {
  const pack = getContextPackById(contextId)
  if (!pack) throw new Error(`Unknown context: ${contextId}`)

  const next = getNextStage(pack, stageId)
  if (!next) return getContextProgress(contextId)

  const root = getAllContextProgress()
  const doc = root.contexts[contextId] ?? createInitialContextProgress(pack)
  const t = Date.now()
  const nextRoot = {
    ...root,
    contexts: {
      ...root.contexts,
      [contextId]: {
        ...doc,
        unlockedStageIds: uniqueAppend(doc.unlockedStageIds, next.id),
        updatedAt: t,
      },
    },
    updatedAt: t,
  }
  saveAllContextProgress(nextRoot)
  return nextRoot.contexts[contextId]
}

/**
 * @param {string} contextId
 * @param {string} stageId
 */
export function setActiveStage(contextId, stageId) {
  const pack = getContextPackById(contextId)
  if (!pack) throw new Error(`Unknown context: ${contextId}`)
  if (!getStageById(pack, stageId)) throw new Error(`Unknown stage: ${stageId}`)

  const root = getAllContextProgress()
  const doc = root.contexts[contextId] ?? createInitialContextProgress(pack)
  if (!doc.unlockedStageIds.includes(stageId)) {
    throw new Error(`Stage not unlocked: ${stageId}`)
  }
  const t = Date.now()
  const nextRoot = {
    ...root,
    contexts: {
      ...root.contexts,
      [contextId]: { ...doc, activeStageId: stageId, updatedAt: t },
    },
    updatedAt: t,
  }
  saveAllContextProgress(nextRoot)
  return nextRoot.contexts[contextId]
}

/**
 * @param {string} contextId
 * @returns {string | null}
 */
export function getActiveStageId(contextId) {
  return getContextProgress(contextId)?.activeStageId ?? null
}

/**
 * @param {string} contextId
 * @param {string} stageId
 * @returns {StageStats | null}
 */
export function getStageProgress(contextId, stageId) {
  const doc = getContextProgress(contextId)
  if (!doc) return null
  return doc.stageStats[stageId] ?? null
}

/**
 * @param {string} contextId
 */
export function resetContextProgress(contextId) {
  const pack = getContextPackById(contextId)
  if (!pack) throw new Error(`Unknown context: ${contextId}`)

  const root = getAllContextProgress()
  const nextRoot = {
    ...root,
    contexts: {
      ...root.contexts,
      [contextId]: createInitialContextProgress(pack),
    },
    updatedAt: Date.now(),
  }
  saveAllContextProgress(nextRoot)
  return nextRoot.contexts[contextId]
}

/**
 * @returns {ProgressRoot}
 */
export function resetAllContextProgress() {
  const empty = normalizeProgressRoot(null)
  saveAllContextProgress(empty)
  return empty
}
