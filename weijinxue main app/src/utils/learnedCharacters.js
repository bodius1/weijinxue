import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase.js'

const STORAGE_KEY = 'learned_characters'

/** @typedef {{ simplified: string, pinyin: string, meaning: string, rating?: number, hskLevel?: number, lastReviewed?: string, timesReviewed?: number }} LearnedChar */

const CLOUD_DEBOUNCE_MS = 450
/** @type {ReturnType<typeof setTimeout> | 0} */
let cloudSyncTimer = 0
let suppressCloudPush = false

function dispatchChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('huaxue-learned-changed'))
}

/** @returns {LearnedChar[]} */
export function readLearnedCharacters() {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const p = JSON.parse(raw)
    if (!Array.isArray(p)) return []
    return p
      .map((x) => ({
        simplified: String(x?.simplified ?? x?.char ?? '').trim(),
        pinyin: String(x?.pinyin ?? '').trim(),
        meaning: String(x?.meaning ?? '').trim(),
        rating: typeof x?.rating === 'number' ? x.rating : undefined,
        hskLevel: typeof x?.hskLevel === 'number' ? x.hskLevel : undefined,
        lastReviewed: typeof x?.lastReviewed === 'string' ? x.lastReviewed : undefined,
        timesReviewed: typeof x?.timesReviewed === 'number' ? x.timesReviewed : undefined,
      }))
      .filter((x) => x.simplified)
  } catch {
    return []
  }
}

/** @param {LearnedChar[]} list */
function writeLearned(list) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    dispatchChanged()
  } catch {
    /* ignore */
  }
  const u = auth.currentUser
  if (u && !suppressCloudPush) scheduleFirestoreSync(u.uid)
}

function scheduleFirestoreSync(uid) {
  clearTimeout(cloudSyncTimer)
  cloudSyncTimer = setTimeout(() => {
    cloudSyncTimer = 0
    const u = auth.currentUser
    if (!u || u.uid !== uid) return
    void syncAllLearnedToFirestore(u.uid, readLearnedCharacters())
  }, CLOUD_DEBOUNCE_MS)
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} data
 * @returns {LearnedChar | null}
 */
function firestoreDocToLearned(id, data) {
  const simplified = String(data?.char ?? id ?? '').trim()
  if (!simplified) return null
  return {
    simplified,
    pinyin: String(data?.pinyin ?? '').trim(),
    meaning: String(data?.meaning ?? '').trim(),
    rating: typeof data?.rating === 'number' ? data.rating : undefined,
    hskLevel: typeof data?.hskLevel === 'number' ? data.hskLevel : undefined,
  }
}

/**
 * @param {LearnedChar[]} local
 * @param {LearnedChar[]} remote
 */
function mergeLearnedLists(local, remote) {
  const map = new Map()
  for (const x of local) {
    if (x.simplified) map.set(x.simplified, { ...x })
  }
  for (const x of remote) {
    if (!x.simplified) continue
    const L = map.get(x.simplified)
    if (!L) {
      map.set(x.simplified, { ...x })
    } else {
      map.set(x.simplified, {
        simplified: x.simplified,
        pinyin: L.pinyin || x.pinyin,
        meaning: L.meaning || x.meaning,
        rating: Math.max(L.rating ?? 0, x.rating ?? 0),
        hskLevel: L.hskLevel ?? x.hskLevel,
      })
    }
  }
  return [...map.values()]
}

/**
 * @param {string} uid
 * @param {LearnedChar[]} list
 */
export async function syncAllLearnedToFirestore(uid, list) {
  const col = collection(db, 'users', uid, 'characters')
  const snap = await getDocs(col)
  const existing = new Map(snap.docs.map((d) => [d.id, d.data()]))
  const want = new Set(list.map((e) => e.simplified))

  /** @type {{ type: 'delete' | 'set', ref: import('firebase/firestore').DocumentReference, data?: Record<string, unknown>, merge?: boolean }[]} */
  const ops = []
  for (const docSnap of snap.docs) {
    if (!want.has(docSnap.id)) ops.push({ type: 'delete', ref: docSnap.ref })
  }
  for (const entry of list) {
    const prev = existing.get(entry.simplified) || {}
    ops.push({
      type: 'set',
      ref: doc(db, 'users', uid, 'characters', entry.simplified),
      data: {
        char: entry.simplified,
        pinyin: entry.pinyin || String(prev.pinyin ?? '') || '',
        meaning: entry.meaning || String(prev.meaning ?? '') || '',
        rating: Math.max(entry.rating ?? 0, Number(prev.rating) || 0),
        timesReviewed: typeof prev.timesReviewed === 'number' ? prev.timesReviewed : 0,
        hskLevel: entry.hskLevel ?? (typeof prev.hskLevel === 'number' ? prev.hskLevel : null),
        lastReviewed: serverTimestamp(),
      },
      merge: true,
    })
  }

  if (ops.length === 0) return

  const CHUNK = 400
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + CHUNK)) {
      if (op.type === 'delete') batch.delete(op.ref)
      else if (op.data) batch.set(op.ref, op.data, { merge: Boolean(op.merge) })
    }
    await batch.commit()
  }
}

/** Merge Firestore quiz deck with localStorage, then mirror to cloud. Call after login. */
export async function mergeLearnedOnLogin(uid) {
  const col = collection(db, 'users', uid, 'characters')
  const snap = await getDocs(col)
  const fromCloud = []
  for (const d of snap.docs) {
    const row = firestoreDocToLearned(d.id, d.data())
    if (row) fromCloud.push(row)
  }
  const local = readLearnedCharacters()
  const merged = mergeLearnedLists(local, fromCloud)
  suppressCloudPush = true
  writeLearned(merged)
  suppressCloudPush = false
  await syncAllLearnedToFirestore(uid, merged)
}

/** @param {string} simplified */
export function isLearnedSaved(simplified) {
  return readLearnedCharacters().some((x) => x.simplified === simplified)
}

/**
 * @param {{ simplified: string, pinyin?: string, meaning?: string, rating?: number, hskLevel?: number }} entry
 * @returns {boolean} true if now saved, false if removed
 */
export function toggleLearnedCharacter(entry) {
  const simplified = String(entry?.simplified ?? '').trim()
  if (!simplified) return false
  const list = readLearnedCharacters()
  const i = list.findIndex((x) => x.simplified === simplified)
  if (i >= 0) {
    list.splice(i, 1)
    writeLearned(list)
    return false
  }
  list.unshift({
    simplified,
    char: simplified,
    pinyin: String(entry?.pinyin ?? '').trim(),
    meaning: String(entry?.meaning ?? '').trim(),
    ...(typeof entry?.rating === 'number' ? { rating: entry.rating } : {}),
    ...(typeof entry?.hskLevel === 'number' ? { hskLevel: entry.hskLevel } : {}),
    ...(typeof entry?.lastReviewed === 'string' && entry.lastReviewed ? { lastReviewed: entry.lastReviewed } : {}),
    ...(typeof entry?.timesReviewed === 'number' ? { timesReviewed: entry.timesReviewed } : {}),
  })
  writeLearned(list)
  return true
}

/**
 * Add or update a saved character without removing it if present.
 * @param {{
 *   simplified: string
 *   pinyin?: string
 *   meaning?: string
 *   rating?: number
 *   hskLevel?: number
 *   lastReviewed?: string
 *   timesReviewed?: number
 * }} entry
 */
export function saveLearnedCharacter(entry) {
  const simplified = String(entry?.simplified ?? '').trim()
  if (!simplified) return
  const list = readLearnedCharacters()
  const i = list.findIndex((x) => x.simplified === simplified)
  const merged = {
    simplified,
    char: simplified,
    pinyin: String(entry?.pinyin ?? '').trim(),
    meaning: String(entry?.meaning ?? '').trim(),
    ...(typeof entry?.rating === 'number' ? { rating: entry.rating } : {}),
    ...(typeof entry?.hskLevel === 'number' ? { hskLevel: entry.hskLevel } : {}),
    ...(typeof entry?.lastReviewed === 'string' && entry.lastReviewed ? { lastReviewed: entry.lastReviewed } : {}),
    ...(typeof entry?.timesReviewed === 'number' ? { timesReviewed: entry.timesReviewed } : {}),
  }
  if (i >= 0) {
    list[i] = { ...list[i], ...merged }
  } else {
    list.unshift(merged)
  }
  writeLearned(list)
}

/** Remove one entry from the quiz deck if present. @param {string} simplified */
export function removeLearnedCharacter(simplified) {
  const s = String(simplified ?? '').trim()
  if (!s) return false
  const list = readLearnedCharacters()
  const i = list.findIndex((x) => x.simplified === s)
  if (i < 0) return false
  list.splice(i, 1)
  writeLearned(list)
  return true
}
