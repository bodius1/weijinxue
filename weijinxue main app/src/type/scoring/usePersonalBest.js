// Firestore paths used by this hook:
// - users/{uid}/typingBests/sentences  (personal best)
// - typeLeaderboard/sentences/hsk{N}/scores/{uid}  (leaderboard per HSK level)
//
// To verify in Firebase Console:
// console.firebase.google.com → Firestore → browse paths above

import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { useAuth } from '../../context/useAuth.js'

function personalBestRef(uid) {
  return doc(db, 'users', uid, 'typingBests', 'sentences')
}

/**
 * @param {number} hskLevel
 * @param {string} uid
 */
function leaderboardEntryRef(hskLevel, uid) {
  return doc(db, 'typeLeaderboard', 'sentences', 'hsk' + hskLevel, 'scores', uid)
}

/**
 * @param {number} [_hskLevel=1]
 */
export function usePersonalBest(_hskLevel = 1) {
  const { user } = useAuth()
  const [personalBest, setPersonalBest] = useState(/** @type {Record<string, unknown> | null} */ (null))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setPersonalBest(null)
        setLoading(false)
      })
      return
    }
    const ref = personalBestRef(user.uid)
    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) setPersonalBest(snap.data())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user])

  const submitScore = useCallback(
    async ({ score, streak, cpm, accuracy, hskLevel }) => {
      if (!user) return false

      const prevScore = Number(personalBest?.score ?? 0)
      if (personalBest && score <= prevScore) return false

      const data = {
        score,
        streak,
        cpm,
        accuracy,
        hskLevel,
        achievedAt: serverTimestamp(),
      }

      const displayName = user.displayName || user.email?.split('@')[0] || 'Anonymous'
      const level = hskLevel ?? _hskLevel

      try {
        await Promise.all([
          setDoc(personalBestRef(user.uid), data),
          setDoc(
            leaderboardEntryRef(level, user.uid),
            { ...data, uid: user.uid, displayName },
            { merge: false },
          ),
        ])
        setPersonalBest(data)
        if (import.meta.env.DEV) {
          console.log('%c[Firestore ✓] Personal best saved', 'color: #D4A843; font-weight: bold', data)
          console.log('%c[Firestore ✓] Leaderboard updated', 'color: #D4A843; font-weight: bold', {
            path: `typeLeaderboard/sentences/hsk${level}/scores/${user.uid}`,
            ...data,
            uid: user.uid,
            displayName,
          })
        }
        return true
      } catch (err) {
        console.error('Failed to save typing score', err)
        return false
      }
    },
    [user, personalBest, _hskLevel],
  )

  return { personalBest, loading, submitScore }
}
