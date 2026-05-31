/**
 * Firestore paths (signed-in user only):
 * - users/{uid}/profile/main
 * - users/{uid}/stats/summary
 * - users/{uid}/studyDays/{YYYY-MM-DD}
 *
 * TODO: Site-wide public counters (Monkeytype-style totals) must NOT be updated from the client.
 * Aggregate via Cloud Functions / Admin SDK or Analytics → BigQuery — see `globalStats.js`.
 */

import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  orderBy,
  startAt,
  endAt,
  serverTimestamp,
  setDoc,
  updateDoc,
  runTransaction,
  documentId,
} from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { compareYMD, localTodayYMD, ymdDiffDays } from './studyDates.js'

const TAB_ALIASES = new Set(['learn', 'flashcards', 'quiz', 'type', 'yuban', 'profile'])

/**
 * @param {Record<string, unknown>} d
 */
function dayActivitySum(d) {
  if (!d || typeof d !== 'object') return 0
  const reviews = Number(d.reviews) || 0
  const flash = Number(d.flashcardsRated) || Number(d.cardsStudied) || 0
  const quiz = Number(d.quizAnswered) || 0
  const typed = Number(d.typedCharacters) || 0
  const sessions = Number(d.typeSessions) || 0
  const secs = Number(d.studySeconds) || 0
  return reviews + flash + quiz + typed + sessions + secs
}

/**
 * @param {import('firebase/auth').User} user
 */
export async function ensureUserProfile(user) {
  if (!user?.uid) return
  const ref = doc(db, 'users', user.uid, 'profile', 'main')
  const snap = await getDoc(ref)
  const pid = user.providerData[0]?.providerId ?? ''
  const providerLabel = pid === 'google.com' ? 'Google' : pid === 'password' ? 'Email' : pid || 'Unknown'

  if (!snap.exists()) {
    await setDoc(ref, {
      createdAt: serverTimestamp(),
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      provider: providerLabel,
      lastLoginAt: serverTimestamp(),
    })
    return
  }

  await updateDoc(ref, {
    lastLoginAt: serverTimestamp(),
    displayName: user.displayName ?? snap.data()?.displayName ?? '',
    email: user.email ?? snap.data()?.email ?? '',
    provider: providerLabel,
  }).catch(() => {
    /* merge if updateDoc fails on missing fields */
    return setDoc(
      ref,
      {
        lastLoginAt: serverTimestamp(),
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        provider: providerLabel,
      },
      { merge: true },
    )
  })
}

/**
 * @param {{
 *   reviews?: number,
 *   flashcardsRated?: number,
 *   cardsStudied?: number,
 *   quizAnswered?: number,
 *   quizCorrect?: number,
 *   typedCharacters?: number,
 *   typeSessions?: number,
 *   studySeconds?: number,
 *   activeTab?: string,
 * }} payload
 */
export async function recordStudyActivity(payload) {
  const u = auth.currentUser
  if (!u?.uid) return

  const addReviews = Math.max(0, Number(payload.reviews) || 0)
  const addFlash = Math.max(0, Number(payload.flashcardsRated ?? payload.cardsStudied) || 0)
  const addQuiz = Math.max(0, Number(payload.quizAnswered) || 0)
  const addQuizCor = Math.max(0, Number(payload.quizCorrect) || 0)
  const addTyped = Math.max(0, Number(payload.typedCharacters) || 0)
  const addTypeSessions = Math.max(0, Number(payload.typeSessions) || 0)
  const addStudySecs = Math.max(0, Math.round(Number(payload.studySeconds) || 0))
  const tabRaw = typeof payload.activeTab === 'string' ? payload.activeTab.trim().toLowerCase() : ''
  const activeTabToken = TAB_ALIASES.has(tabRaw) ? tabRaw : ''

  if (addReviews + addFlash + addQuiz + addTyped + addTypeSessions + addStudySecs <= 0) return

  const uid = u.uid
  const dateStr = localTodayYMD()
  const dayRef = doc(db, 'users', uid, 'studyDays', dateStr)
  const summaryRef = doc(db, 'users', uid, 'stats', 'summary')

  try {
    await runTransaction(db, async (tx) => {
      const sumSnap = await tx.get(summaryRef)
      const daySnap = await tx.get(dayRef)
      const prevDay = daySnap.exists() ? daySnap.data() : {}
      const prevSum = sumSnap.exists() ? sumSnap.data() : {}

      const prevTotalToday = dayActivitySum(prevDay)
      const firstMeaningfulToday = prevTotalToday === 0

      let currentStreak = Number(prevSum.currentStreak) || 0
      let longestStreak = Number(prevSum.longestStreak) || 0
      const lastStudyDate = prevSum.lastStudyDate ? String(prevSum.lastStudyDate) : null

      if (firstMeaningfulToday) {
        if (!lastStudyDate) {
          currentStreak = 1
        } else {
          const cmp = compareYMD(lastStudyDate, dateStr)
          if (cmp === 0) {
            currentStreak = Number(prevSum.currentStreak) || 1
          } else if (cmp < 0) {
            const gap = ymdDiffDays(lastStudyDate, dateStr)
            if (gap === 1) currentStreak = (currentStreak || 0) + 1
            else currentStreak = 1
          } else {
            currentStreak = 1
          }
        }
        longestStreak = Math.max(longestStreak, currentStreak)
      }

      /** @type {Record<string, unknown>} */
      const dayPatch = {
        date: dateStr,
        reviews: increment(addReviews),
        flashcardsRated: increment(addFlash),
        quizAnswered: increment(addQuiz),
        quizCorrect: increment(addQuizCor),
        typedCharacters: increment(addTyped),
        typeSessions: increment(addTypeSessions),
        studySeconds: increment(addStudySecs),
        updatedAt: serverTimestamp(),
      }
      if (activeTabToken) {
        dayPatch.activeTabs = arrayUnion(activeTabToken)
      }

      tx.set(dayRef, dayPatch, { merge: true })

      /** @type {Record<string, unknown>} */
      const summaryUpdate = {
        totalReviews: increment(addReviews),
        totalFlashcardsRated: increment(addFlash),
        totalQuizAnswered: increment(addQuiz),
        totalQuizCorrect: increment(addQuizCor),
        totalTypedCharacters: increment(addTyped),
        totalTypeSessions: increment(addTypeSessions),
        totalStudySeconds: increment(addStudySecs),
        lastStudyDate: dateStr,
        updatedAt: serverTimestamp(),
      }

      if (firstMeaningfulToday) {
        summaryUpdate.currentStreak = currentStreak
        summaryUpdate.longestStreak = longestStreak
      }

      tx.set(summaryRef, summaryUpdate, { merge: true })
    })
  } catch (err) {
    console.warn('[studyStats] recordStudyActivity failed', err)
  }
}

/**
 * @param {string} uid
 * @param {number} year
 */
export async function fetchStudyDaysForYear(uid, year) {
  const col = collection(db, 'users', uid, 'studyDays')
  const qy = query(col, orderBy(documentId()), startAt(`${year}-01-01`), endAt(`${year}-12-31`))
  const snap = await getDocs(qy)
  /** @type {Record<string, Record<string, number>>} */
  const map = {}
  snap.docs.forEach((d) => {
    const x = d.data()
    map[d.id] = {
      reviews: typeof x.reviews === 'number' ? x.reviews : 0,
      flashcardsRated: typeof x.flashcardsRated === 'number' ? x.flashcardsRated : 0,
      cardsStudied: typeof x.cardsStudied === 'number' ? x.cardsStudied : 0,
      quizAnswered: typeof x.quizAnswered === 'number' ? x.quizAnswered : 0,
      quizCorrect: typeof x.quizCorrect === 'number' ? x.quizCorrect : 0,
      typedCharacters: typeof x.typedCharacters === 'number' ? x.typedCharacters : 0,
      typeSessions: typeof x.typeSessions === 'number' ? x.typeSessions : 0,
      studySeconds: typeof x.studySeconds === 'number' ? x.studySeconds : 0,
    }
  })
  return map
}

/** @param {string} uid */
export async function fetchStatsSummary(uid) {
  const ref = doc(db, 'users', uid, 'stats', 'summary')
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    return {
      totalReviews: 0,
      totalFlashcardsRated: 0,
      totalCardsStudied: 0,
      totalQuizAnswered: 0,
      totalQuizCorrect: 0,
      totalTypeSessions: 0,
      totalTypedCharacters: 0,
      totalStudySeconds: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null,
    }
  }
  const x = snap.data()
  const totalFlash =
    Number(x.totalFlashcardsRated) || Number(x.totalCardsStudied) || 0
  return {
    totalReviews: Number(x.totalReviews) || 0,
    totalFlashcardsRated: totalFlash,
    totalCardsStudied: Number(x.totalCardsStudied) || 0,
    totalQuizAnswered: Number(x.totalQuizAnswered) || 0,
    totalQuizCorrect: Number(x.totalQuizCorrect) || 0,
    totalTypeSessions: Number(x.totalTypeSessions) || 0,
    totalTypedCharacters: Number(x.totalTypedCharacters) || 0,
    totalStudySeconds: Number(x.totalStudySeconds) || 0,
    currentStreak: Number(x.currentStreak) || 0,
    longestStreak: Number(x.longestStreak) || 0,
    lastStudyDate: x.lastStudyDate != null ? String(x.lastStudyDate) : null,
  }
}

/** @param {string} uid */
export async function fetchProfileDoc(uid) {
  const ref = doc(db, 'users', uid, 'profile', 'main')
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data()
}
