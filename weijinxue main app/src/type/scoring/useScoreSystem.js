import { useState, useCallback, useRef, useEffect } from 'react'
import { getMultiplier, pointsForChar } from './scoreHelpers.js'

/**
 * @param {number} streak
 */
export function useScoreSystem(streak) {
  const [score, setScore] = useState(0)
  const [sessionBestStreak, setSessionBestStreak] = useState(0)
  const [orbEvents, setOrbEvents] = useState(/** @type {Array<{ id: number, fromX: number, fromY: number, points: number, alive: boolean }>} */ ([]))
  const [orbArrivalCount, setOrbArrivalCount] = useState(0)
  const orbIdRef = useRef(0)
  const inflightIds = useRef(/** @type {Set<number>} */ (new Set()))
  const orbTimersRef = useRef(/** @type {Map<number, number>} */ (new Map()))

  const multiplier = getMultiplier(streak)

  useEffect(() => {
    return () => {
      for (const id of orbTimersRef.current.values()) {
        window.clearTimeout(id)
      }
      orbTimersRef.current.clear()
    }
  }, [])

  const updateSessionBest = useCallback((s) => {
    setSessionBestStreak((prev) => Math.max(prev, s))
  }, [])

  const emitXPOrb = useCallback(
    (fromX, fromY, streakOverride) => {
      const s = typeof streakOverride === 'number' ? streakOverride : streak
      const points = pointsForChar(s)
      const mult = getMultiplier(s)

      if (mult <= 1) {
        setScore((prev) => prev + points)
        return
      }

      const id = orbIdRef.current++
      inflightIds.current.add(id)

      setOrbEvents((prev) => [...prev, { id, fromX, fromY, points, alive: true }])

      const timerId = window.setTimeout(() => {
        orbTimersRef.current.delete(id)
        inflightIds.current.delete(id)
        setScore((prev) => prev + points)
        setOrbArrivalCount((c) => c + 1)
        setOrbEvents((prev) => prev.filter((o) => o.id !== id))
      }, 700)

      orbTimersRef.current.set(id, timerId)
    },
    [streak],
  )

  const dissolveOrbs = useCallback(() => {
    for (const id of orbTimersRef.current.values()) {
      window.clearTimeout(id)
    }
    orbTimersRef.current.clear()
    inflightIds.current.clear()
    setOrbEvents([])
  }, [])

  const reset = useCallback(() => {
    for (const id of orbTimersRef.current.values()) {
      window.clearTimeout(id)
    }
    orbTimersRef.current.clear()
    inflightIds.current.clear()
    setScore(0)
    setOrbEvents([])
    setOrbArrivalCount(0)
    setSessionBestStreak(0)
  }, [])

  return {
    score,
    multiplier,
    sessionBestStreak,
    orbEvents,
    orbArrivalCount,
    emitXPOrb,
    dissolveOrbs,
    updateSessionBest,
    reset,
  }
}
