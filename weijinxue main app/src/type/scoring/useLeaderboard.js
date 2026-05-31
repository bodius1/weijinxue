// Firestore paths used by this hook:
// - typeLeaderboard/sentences/hsk{N}/scores/{uid}  (leaderboard per HSK level)
//
// To verify in Firebase Console:
// console.firebase.google.com → Firestore → browse paths above

import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { useAuth } from '../../context/useAuth.js'

/**
 * @param {number} hskLevel
 */
function leaderboardCollection(hskLevel) {
  return collection(db, 'typeLeaderboard', 'sentences', 'hsk' + hskLevel, 'scores')
}

/**
 * @param {number} [hskLevel=1]
 */
export function useLeaderboard(hskLevel = 1) {
  const { user } = useAuth()
  const [entries, setEntries] = useState(/** @type {Array<Record<string, unknown> & { id: string }>} */ ([]))
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(leaderboardCollection(hskLevel), orderBy('score', 'desc'), limit(20))
      const snap = await getDocs(q)
      const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setEntries(loaded)
      if (import.meta.env.DEV) {
        console.log(
          '%c[Firestore ✓] Leaderboard loaded',
          'color: #D4A843; font-weight: bold',
          `HSK ${hskLevel}`,
          loaded.map((e) => `${e.displayName}: ${e.score}`),
        )
      }
    } catch (err) {
      console.error('Leaderboard fetch failed', err)
      setEntries([])
    }
    setLoading(false)
  }, [hskLevel])

  useEffect(() => {
    void fetchLeaderboard()
  }, [fetchLeaderboard])

  const userRank = user ? entries.findIndex((e) => e.uid === user.uid) + 1 : 0

  return { entries, loading, userRank, refresh: fetchLeaderboard }
}
