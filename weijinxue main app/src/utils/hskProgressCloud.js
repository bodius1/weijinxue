import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'

/**
 * @param {number} level
 * @param {number} mastered
 * @param {number} total
 */
export async function pushHskProgressLevel(level, mastered, total) {
  const user = auth.currentUser
  if (!user) return
  await setDoc(
    doc(db, 'users', user.uid, 'hskProgress', String(level)),
    {
      level,
      mastered,
      total,
      lastStudied: serverTimestamp(),
    },
    { merge: true },
  )
}
