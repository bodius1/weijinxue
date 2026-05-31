import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase.js'

/**
 * @param {string} uid
 * @param {{ exam: import('./data/H11329.js').H11329, answers: Record<number, string>, durationSeconds: number }} payload
 */
export async function saveExamAttempt(uid, { exam, answers, durationSeconds }) {
  if (!uid) return
  let listening = 0
  let reading = 0
  for (let q = 1; q <= 20; q += 1) {
    if (answers[q] === exam.answerKey[q]) listening += 1
  }
  for (let q = 21; q <= 40; q += 1) {
    if (answers[q] === exam.answerKey[q]) reading += 1
  }
  const total = listening + reading
  const percent = Math.round((total / 40) * 100)
  const passed = total >= 24
  const ts = Date.now()
  const ref = collection(db, 'users', uid, 'examAttempts')
  await addDoc(ref, {
    examId: exam.examId,
    hskLevel: exam.hskLevel,
    examNumber: exam.examNumber,
    attemptedAt: serverTimestamp(),
    durationSeconds,
    score: { listening, reading, total, percent, passed },
    answers,
    _clientId: `${exam.examId}_${ts}`,
  })
}

/**
 * @param {string} uid
 * @param {string} examId
 */
export async function fetchExamAttempts(uid, examId, max = 5) {
  if (!uid) return []
  const ref = collection(db, 'users', uid, 'examAttempts')
  const q = query(ref, where('examId', '==', examId), orderBy('attemptedAt', 'desc'), limit(max))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** @param {import('firebase/firestore').Timestamp | Date | { seconds: number } | null | undefined} ts */
export function formatAttemptDate(ts) {
  if (!ts) return '—'
  const d =
    ts instanceof Date
      ? ts
      : typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof ts.toDate === 'function'
        ? ts.toDate()
        : typeof ts === 'object' && ts !== null && 'seconds' in ts
          ? new Date(ts.seconds * 1000)
          : null
  if (!d || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
