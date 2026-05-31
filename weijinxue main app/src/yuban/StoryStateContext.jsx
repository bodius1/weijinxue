import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../context/useAuth.js'

/** @typedef {import('firebase/firestore').Timestamp} FirestoreTimestamp */

/**
 * @typedef {object} YubanStoryState
 * @property {boolean} [initialized]
 * @property {FirestoreTimestamp | number | null} [createdAt]
 * @property {FirestoreTimestamp | number | null} [updatedAt]
 * @property {string} [chineseName]
 * @property {string} [pinyinName]
 * @property {string} [englishName]
 * @property {number} [hskLevel]
 * @property {string} [city]
 * @property {number} [daysInChina]
 * @property {number} [sessionsCompleted]
 * @property {FirestoreTimestamp | number | null} [lastSessionAt]
 * @property {string} [currentScenario]
 * @property {{ date?: string, summary: string, scenario?: string }[]} [storyLog]
 * @property {Record<string, object>} [npcs]
 * @property {Record<string, object>} [vocabulary]
 * @property {unknown[]} [mistakeLog]
 * @property {Record<string, unknown>} [patternMastery]
 * @property {{ dialogueHanzi: string, productionPrompt: string, expectedPatternHint: string, evaluation?: string }[]} [recentProductionBeats]
 */

/** @typedef {{
 *   state: YubanStoryState | null,
 *   loading: boolean,
 *   updateState: (patch: Partial<YubanStoryState>) => Promise<void>,
 *   initializeState: (initialData: Partial<YubanStoryState>) => Promise<void>,
 *   isOnboarded: boolean,
 * }} StoryStateContextValue */

const StoryStateContext = createContext(/** @type {StoryStateContextValue | null} */ (null))

function storyDocRef(uid) {
  return doc(db, 'users', uid, 'yubanState', 'main')
}

export function StoryStateProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState(/** @type {YubanStoryState | null} */ (null))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setState(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    const ref = storyDocRef(user.uid)

    getDoc(ref)
      .then((snap) => {
        if (cancelled) return
        setState(snap.exists() ? /** @type {YubanStoryState} */ (snap.data()) : null)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load story state', err)
        if (!cancelled) {
          setState(null)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const updateState = useCallback(
    /** @param {Partial<YubanStoryState>} patch */
    async (patch) => {
      if (!user) return
      setState((prev) => (prev ? { ...prev, ...patch, updatedAt: Date.now() } : prev))
      try {
        await updateDoc(storyDocRef(user.uid), { ...patch, updatedAt: serverTimestamp() })
      } catch (err) {
        console.error('Failed to update story state', err)
      }
    },
    [user],
  )

  const initializeState = useCallback(
    /** @param {Partial<YubanStoryState>} initialData */
    async (initialData) => {
      if (!user) return
      const fullState = {
        initialized: true,
        daysInChina: 0,
        sessionsCompleted: 0,
        lastSessionAt: null,
        storyLog: [],
        npcs: {},
        vocabulary: {},
        mistakeLog: [],
        patternMastery: {},
        confidenceLog: [],
        teaBreaksShown: [],
        ...initialData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setState(fullState)
      try {
        await setDoc(storyDocRef(user.uid), {
          ...fullState,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } catch (err) {
        console.error('Failed to initialize story state', err)
      }
    },
    [user],
  )

  const value = useMemo(
    () => ({
      state,
      loading,
      updateState,
      initializeState,
      isOnboarded: Boolean(state?.initialized),
    }),
    [state, loading, updateState, initializeState],
  )

  return <StoryStateContext.Provider value={value}>{children}</StoryStateContext.Provider>
}

export function useStoryState() {
  const ctx = useContext(StoryStateContext)
  if (!ctx) {
    throw new Error('useStoryState must be used inside StoryStateProvider')
  }
  return ctx
}
