import { useCallback, useEffect, useMemo, useState } from 'react'
import { getContextPackById } from '../data/contextPacks/index.js'
import { getStageById } from '../engine/contextPackSchema.js'
import {
  ensureContextProgress,
  getContextProgress,
  markStageComplete as markStageCompleteStore,
  recordAiTurn as recordAiTurnStore,
  recordDrillAttempt as recordDrillAttemptStore,
  resetContextProgress as resetContextProgressStore,
  setActiveStage as setActiveStageStore,
} from '../engine/contextProgressStore.js'

/**
 * React hook for Context Journey progress (local-first, Phase 3A).
 *
 * @param {import('../engine/contextPackSchema.js').ContextPack | string} contextPackOrId
 */
export function useContextProgress(contextPackOrId) {
  const pack = useMemo(() => {
    if (!contextPackOrId) return null
    return typeof contextPackOrId === 'string'
      ? getContextPackById(contextPackOrId)
      : contextPackOrId
  }, [contextPackOrId])

  const contextId = pack?.id ?? null

  const [progress, setProgress] = useState(() => {
    if (!pack) return null
    return getContextProgress(pack.id) ?? ensureContextProgress(pack)
  })

  const refreshProgress = useCallback(() => {
    if (!pack) {
      setProgress(null)
      return null
    }
    const doc = getContextProgress(pack.id) ?? ensureContextProgress(pack)
    setProgress(doc)
    return doc
  }, [pack])

  useEffect(() => {
    if (!pack) {
      setProgress(null)
      return
    }
    refreshProgress()
  }, [pack, refreshProgress])

  const activeStageId = progress?.activeStageId ?? null

  const activeStage = useMemo(() => {
    if (!pack || !activeStageId) return null
    return getStageById(pack, activeStageId) ?? null
  }, [pack, activeStageId])

  const unlockedStageIds = progress?.unlockedStageIds ?? []
  const completedStageIds = progress?.completedStageIds ?? []
  const stageStats = progress?.stageStats ?? {}

  const recordDrillAttempt = useCallback(
    (stageId, drillId, wasCorrect) => {
      if (!contextId) return null
      const doc = recordDrillAttemptStore(contextId, stageId, drillId, wasCorrect)
      setProgress(doc)
      return doc
    },
    [contextId],
  )

  const recordAiTurn = useCallback(
    (stageId, options) => {
      if (!contextId) return null
      const doc = recordAiTurnStore(contextId, stageId, options)
      setProgress(doc)
      return doc
    },
    [contextId],
  )

  const markStageComplete = useCallback(
    (stageId) => {
      if (!contextId) return null
      const doc = markStageCompleteStore(contextId, stageId)
      setProgress(doc)
      return doc
    },
    [contextId],
  )

  const setActiveStage = useCallback(
    (stageId) => {
      if (!contextId) return null
      const doc = setActiveStageStore(contextId, stageId)
      setProgress(doc)
      return doc
    },
    [contextId],
  )

  const resetProgress = useCallback(() => {
    if (!contextId) return null
    const doc = resetContextProgressStore(contextId)
    setProgress(doc)
    return doc
  }, [contextId])

  return {
    pack,
    contextId,
    progress,
    activeStageId,
    activeStage,
    unlockedStageIds,
    completedStageIds,
    stageStats,
    recordDrillAttempt,
    recordAiTurn,
    markStageComplete,
    setActiveStage,
    resetProgress,
    refreshProgress,
  }
}
