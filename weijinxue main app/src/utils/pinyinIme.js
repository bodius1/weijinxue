/**
 * Shared IME-style pinyin lookup (CC-CEDICT). Used by TypeTab and YubanTab.
 * HSK lists load from `src/data/hsk*.json` via URL (Vite emits them as separate assets, not the main bundle).
 * CC-CEDICT loads via dynamic import — see {@link preloadPinyinImeData}.
 */

/** @type {any | null} */
let _cedict = null

/** @type {Promise<any> | null} */
let _dictionaryPromise = null

/** @type {Promise<void> | null} */
let _hskPreloadPromise = null

/** @type {Promise<void> | null} */
let _preloadPromise = null

/** Six HSK word lists (filled after {@link preloadPinyinImeData}). */
export const HSK_DATA = [[], [], [], [], [], []]

/** @typedef {{ simplified: string, pinyin: string, english: string[] }} CedictEntry */

export const MAX_RESULTS = 800
export const MAX_SORT_INPUT = 650

/** Substrings in English gloss that hide noisy dictionary rows for learners. */
export const ENGLISH_EXCLUDE_MARKERS = [
  'variant of',
  'abbr.',
  'old variant',
  'archaic',
  'surname',
  '(dialect)',
]

/** Lowest HSK list (1–6) where the full simplified form appears as a vocabulary item. */
function buildWordMinHsk() {
  const m = new Map()
  HSK_DATA.forEach((data, idx) => {
    const level = idx + 1
    if (!Array.isArray(data)) return
    for (const raw of data) {
      const s = String(raw?.simplified ?? '').trim()
      if (!s) continue
      const prev = m.get(s)
      if (prev === undefined || level < prev) m.set(s, level)
    }
  })
  return m
}

/** Rebuilt after HSK JSON is loaded. */
export let WORD_MIN_HSK = buildWordMinHsk()

function rebuildWordMinHsk() {
  WORD_MIN_HSK = buildWordMinHsk()
}

/**
 * Fetch HSK 1–6 from `src/data/` without loading CC-CEDICT.
 * Safe to call multiple times; subsequent calls return the same promise.
 */
export function preloadHskData() {
  if (_hskPreloadPromise) return _hskPreloadPromise
  _hskPreloadPromise = (async () => {
    const urls = [1, 2, 3, 4, 5, 6].map((n) => new URL(`../data/hsk${n}.json`, import.meta.url).href)
    const levels = await Promise.all(
      urls.map((u) =>
        fetch(u).then((r) => {
          if (!r.ok) throw new Error(`Failed to load ${u}: ${r.status}`)
          return r.json()
        }),
      ),
    )
    for (let i = 0; i < 6; i += 1) {
      HSK_DATA[i] = Array.isArray(levels[i]) ? levels[i] : []
    }
    rebuildWordMinHsk()

    const { resetMultipleChoiceQuizHskCache } = await import('./multipleChoiceQuizCore.js')
    resetMultipleChoiceQuizHskCache()
  })().catch((err) => {
    _hskPreloadPromise = null
    throw err
  })
  return _hskPreloadPromise
}

export async function getDictionary() {
  if (_cedict) return _cedict
  if (!_dictionaryPromise) {
    _dictionaryPromise = import('cc-cedict')
      .then((mod) => {
        _cedict = mod.default
        return _cedict
      })
      .catch((err) => {
        _dictionaryPromise = null
        throw err
      })
  }
  return _dictionaryPromise
}

/**
 * Fetch HSK 1–6 and load CC-CEDICT via dynamic import.
 * Safe to call multiple times; subsequent calls return the same promise.
 */
export function preloadPinyinImeData() {
  if (_preloadPromise) return _preloadPromise
  _preloadPromise = (async () => {
    await Promise.all([preloadHskData(), getDictionary()])
  })().catch((err) => {
    _preloadPromise = null
    throw err
  })
  return _preloadPromise
}

export function getCedictOrNull() {
  return _cedict
}

export function passesLengthFilter(entry, queryNorm) {
  const ql = queryNorm.length
  const n = entry.simplified.length
  if (ql <= 2) return n === 1
  if (ql <= 4) return n <= 2
  if (ql <= 6) return n <= 3
  return n <= 4
}

export function passesQualityFilter(entry) {
  const blob = entry.english.join(' / ').toLowerCase()
  for (let i = 0; i < ENGLISH_EXCLUDE_MARKERS.length; i++) {
    if (blob.includes(ENGLISH_EXCLUDE_MARKERS[i])) return false
  }
  return true
}

/** True if `simplified` is a headword row in `HSK_DATA[level - 1]` (level 1–6). */
export function isHeadwordInHskLevel(simplified, level) {
  const lv = Number(level)
  if (!Number.isFinite(lv) || lv < 1 || lv > 6) return false
  const arr = HSK_DATA[lv - 1]
  if (!Array.isArray(arr)) return false
  const s = String(simplified ?? '').trim()
  if (!s) return false
  for (const raw of arr) {
    if (String(raw?.simplified ?? '').trim() === s) return true
  }
  return false
}

/**
 * First Han in a composite sentence lookahead (e.g. "你喝水" → "你") for IME ordering.
 * Full `targetSimp` is still used elsewhere for anti-spoiler + exact commit.
 * @param {string | undefined} targetSimp
 * @returns {string | undefined}
 */
function activeHanForImeOrdering(targetSimp) {
  if (targetSimp === undefined || targetSimp === null) return undefined
  const s = String(targetSimp)
  if (!s) return undefined
  const first = [...s][0]
  return first && /^[\u4e00-\u9fff]$/u.test(first) ? first : undefined
}

/**
 * List position in `HSK_DATA[level - 1]` (earlier ≈ more basic / frequent in course order).
 * @param {number} level 1–6
 * @param {string} simplified
 */
function hskListOrderIndex(level, simplified) {
  const arr = HSK_DATA[level - 1]
  if (!Array.isArray(arr)) return Number.POSITIVE_INFINITY
  const key = String(simplified ?? '').trim()
  if (!key) return Number.POSITIVE_INFINITY
  for (let i = 0; i < arr.length; i += 1) {
    if (String(arr[i]?.simplified ?? '').trim() === key) return i
  }
  return Number.POSITIVE_INFINITY
}

/**
 * After length + quality filters. Order: target word, then exact-pinyin + 1-char,
 * HSK1 words, HSK2, HSK3+, then rest by ascending simplified length.
 * @param {number | null | undefined} boostHskLevel When set (sentence mode), prefer headwords from that HSK list.
 */
export function sortFilteredImeCandidates(entries, queryNorm, targetSimp, boostHskLevel, targetPinyin) {
  const fullTarget = targetSimp && targetPinyin ? fullTonelessPinyin(targetPinyin) : ''
  /** Pin #1 only after the typed query exactly matches the target toneless pinyin (not a syllable prefix like `z` → `zhuo`). */
  const orderPin =
    fullTarget && queryNorm === fullTarget
      ? boostHskLevel != null && boostHskLevel >= 1 && boostHskLevel <= 6
        ? activeHanForImeOrdering(targetSimp)
        : String(targetSimp ?? '').length === 1
          ? activeHanForImeOrdering(targetSimp)
          : undefined
      : undefined
  const full = (e) => fullTonelessPinyin(e.pinyin)
  const inBoost = (e) =>
    boostHskLevel != null &&
    boostHskLevel >= 1 &&
    boostHskLevel <= 6 &&
    isHeadwordInHskLevel(e.simplified, boostHskLevel)
  const tier = (e) => {
    const fv = full(e)
    if (boostHskLevel != null) {
      if (inBoost(e) && fv === queryNorm && e.simplified.length === 1) return -1
      if (fv === queryNorm && e.simplified.length === 1) return 0
      if (inBoost(e) && e.simplified.length === 1 && fv.startsWith(queryNorm)) return 1
    } else if (fv === queryNorm && e.simplified.length === 1) {
      return 0
    }
    const lv = WORD_MIN_HSK.get(e.simplified)
    if (lv === 1) return 2
    if (lv === 2) return 3
    if (lv !== undefined && lv >= 3) return 4
    return 5
  }
  return [...entries].sort((a, b) => {
    const ta = orderPin !== undefined && a.simplified === orderPin
    const tb = orderPin !== undefined && b.simplified === orderPin
    if (ta !== tb) return ta ? -1 : 1

    const ra = tier(a)
    const rb = tier(b)
    if (ra !== rb) return ra - rb

    const la = a.simplified.length - b.simplified.length
    if (la !== 0) return la

    if (boostHskLevel != null && boostHskLevel >= 1 && boostHskLevel <= 6) {
      const oa = hskListOrderIndex(boostHskLevel, a.simplified)
      const ob = hskListOrderIndex(boostHskLevel, b.simplified)
      if (oa !== ob) return oa - ob
    }

    const fa = full(a)
    const fb = full(b)
    if (fa !== fb) return fa.localeCompare(fb)
    return a.simplified.localeCompare(b.simplified, 'zh')
  })
}

/** @type {Map<string, CedictEntry[]> | null} */
let cedictEntriesBySimplified = null

function ensureCedictSimplifiedIndex() {
  const dict = _cedict
  if (!dict) return
  if (cedictEntriesBySimplified) return
  cedictEntriesBySimplified = new Map()
  const all = dict.data.all
  for (let i = 0; i < all.length; i++) {
    const raw = all[i]
    const s = raw[1]
    if (typeof s !== 'string' || !isAllHan(s)) continue
    const entry = dict.expandValue(raw, false)
    const list = cedictEntriesBySimplified.get(s)
    if (list) list.push(entry)
    else cedictEntriesBySimplified.set(s, [entry])
  }
}

/**
 * Exact `simplified` match in CC-CEDICT. If several rows share the same form (readings),
 * prefer the one whose toneless pinyin matches `disambiguatePinyin` (e.g. HSK list field).
 * @param {string} simplified
 * @param {string} [disambiguatePinyin]
 * @returns {CedictEntry | null}
 */
export function pickCedictEntryForWord(simplified, disambiguatePinyin) {
  if (!_cedict) return null
  ensureCedictSimplifiedIndex()
  const key = String(simplified ?? '').trim()
  if (!key) return null
  const matches = cedictEntriesBySimplified?.get(key) ?? []
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]
  const prefer = disambiguatePinyin ? fullTonelessPinyin(String(disambiguatePinyin)) : ''
  if (prefer) {
    const hit = matches.find((e) => fullTonelessPinyin(e.pinyin) === prefer)
    if (hit) return hit
  }
  return matches[0]
}

/** @returns {Map<string, Map<string, CedictEntry>>} prefix → (uid → entry) */
export function buildPinyinPrefixIndex() {
  const dict = _cedict
  const map = new Map()
  if (!dict) return map
  const all = dict.data.all
  for (let i = 0; i < all.length; i++) {
    const raw = all[i]
    const simp = raw[1]
    if (!isAllHan(simp)) continue
    const pin = raw[2]
    if (typeof pin !== 'string') continue
    const full = fullTonelessPinyin(pin)
    if (!full) continue
    const uid = `${simp}|${pin}`
    const entry = dict.expandValue(raw, false)
    for (let len = 1; len <= full.length; len++) {
      const pre = full.slice(0, len)
      let bucket = map.get(pre)
      if (!bucket) {
        bucket = new Map()
        map.set(pre, bucket)
      }
      bucket.set(uid, entry)
    }
  }
  return map
}

/**
 * Multi-char targets: hide only while the user is typing a *correct prefix* of the expected toneless string.
 * If they diverge (e.g. yinle vs yīnyuè), still show the phrase so they can recover.
 */
export function shouldOmitTargetFromCandidates(targetSimp, targetPinyin, queryNorm) {
  if (!targetSimp || !targetPinyin) return false
  const full = fullTonelessPinyin(targetPinyin)
  if (!full) return false
  if (queryNorm.length >= full.length) return false
  return full.startsWith(queryNorm)
}

/**
 * Toneless syllables from a space-separated pinyin field (e.g. `zhuo1` → `zhuo`, `yī xià` → `yi`, `xia`).
 * @param {string} pinyinField
 * @returns {string[]}
 */
export function tonelessSyllablesFromPinyinField(pinyinField) {
  if (!pinyinField || typeof pinyinField !== 'string') return []
  return pinyinField
    .trim()
    .split(/\s+/)
    .map((syl) => fullTonelessPinyin(syl))
    .filter(Boolean)
}

/**
 * True when `queryNorm` equals the toneless join of the first k syllables (k ≥ 1), or the full string.
 * Rejects in-syllable prefixes (e.g. `z` is not a match for `zhuo`).
 * @param {string} queryNorm
 * @param {string} pinyinField
 */
export function queryMatchesSyllablePrefix(queryNorm, pinyinField) {
  const q = String(queryNorm ?? '').trim()
  if (!q) return false
  const syllables = tonelessSyllablesFromPinyinField(pinyinField)
  if (!syllables.length) return false
  let built = ''
  for (const syl of syllables) {
    built += syl
    if (q === built) return true
  }
  return false
}

/** Append entries from another prefix bucket (dedupe by simplified|pinyin). */
function mergeImeBucket(fromList, index, keyNorm) {
  const b = index.get(keyNorm)
  if (!b || !keyNorm) return fromList
  const seen = new Set(fromList.map((e) => `${e.simplified}|${e.pinyin}`))
  const out = [...fromList]
  for (const e of b.values()) {
    const uid = `${e.simplified}|${e.pinyin}`
    if (!seen.has(uid)) {
      seen.add(uid)
      out.push(e)
    }
  }
  return out
}

/**
 * Synthetic CC-CEDICT-shaped rows from the active HSK list for sentence IME (prefix match on toneless pinyin).
 * @param {number} boostLevel 1–6
 * @param {string} queryNorm
 * @returns {CedictEntry[]}
 */
function collectHskImeExtrasForQuery(boostLevel, queryNorm) {
  const arr = HSK_DATA[boostLevel - 1]
  if (!Array.isArray(arr) || !queryNorm) return []
  /** @type {CedictEntry[]} */
  const out = []
  for (const raw of arr) {
    const simp = String(raw?.simplified ?? '').trim()
    const pin = String(raw?.pinyin ?? '').trim()
    const eng = String(raw?.english ?? '').trim()
    if (!simp || !pin) continue
    /** @type {CedictEntry} */
    const entry = {
      simplified: simp,
      pinyin: pin,
      english: eng ? [eng] : [''],
    }
    if (!passesLengthFilter(entry, queryNorm)) continue
    if (!fullTonelessPinyin(pin).startsWith(queryNorm)) continue
    if (!passesQualityFilter(entry)) continue
    out.push(entry)
  }
  return out
}

/**
 * @param {Map<string, Map<string, CedictEntry>> | null} index
 * @param {string} queryNorm
 * @param {string | undefined} targetSimp
 * @param {string | undefined} targetPinyin
 * @param {string | undefined} [targetEnglish] HSK gloss when synthesizing a missing target row
 * @param {number | null | undefined} [boostHskLevel] Sentence mode: merge + rank using this HSK list (1–6).
 */
export function lookupFromIndex(index, queryNorm, targetSimp, targetPinyin, targetEnglish, boostHskLevel) {
  if (!queryNorm || !index) return []
  const bucket = index.get(queryNorm)
  let rawList = bucket ? [...bucket.values()] : []

  const fullTargetPinyin = targetSimp && targetPinyin ? fullTonelessPinyin(targetPinyin) : ''
  if (
    boostHskLevel != null &&
    boostHskLevel >= 1 &&
    boostHskLevel <= 6 &&
    fullTargetPinyin &&
    fullTargetPinyin !== queryNorm &&
    targetPinyin &&
    queryMatchesSyllablePrefix(queryNorm, targetPinyin)
  ) {
    rawList = mergeImeBucket(rawList, index, fullTargetPinyin)
  }

  let filtered = rawList.filter(
    (e) => passesLengthFilter(e, queryNorm) && passesQualityFilter(e),
  )

  if (boostHskLevel != null && boostHskLevel >= 1 && boostHskLevel <= 6) {
    const extras = collectHskImeExtrasForQuery(boostHskLevel, queryNorm)
    const bySimp = new Map()
    for (const e of filtered) bySimp.set(e.simplified, e)
    for (const e of extras) bySimp.set(e.simplified, e)
    filtered = [...bySimp.values()]
  }

  if (shouldOmitTargetFromCandidates(targetSimp, targetPinyin, queryNorm)) {
    filtered = filtered.filter((e) => e.simplified !== targetSimp)
  }

  if (filtered.length > MAX_SORT_INPUT) {
    /** @type {Set<string>} */
    const taken = new Set()
    const out = []
    const pushUnique = (/** @type {CedictEntry} */ e) => {
      if (!e || taken.has(e.simplified) || out.length >= MAX_SORT_INPUT) return
      out.push(e)
      taken.add(e.simplified)
    }
    const targetHit = targetSimp ? filtered.find((e) => e.simplified === targetSimp) : undefined
    if (targetHit) pushUnique(targetHit)
    if (boostHskLevel != null && boostHskLevel >= 1 && boostHskLevel <= 6) {
      for (const e of filtered) {
        if (out.length >= MAX_SORT_INPUT) break
        if (isHeadwordInHskLevel(e.simplified, boostHskLevel)) pushUnique(e)
      }
    }
    for (const e of filtered) {
      if (out.length >= MAX_SORT_INPUT) break
      pushUnique(e)
    }
    filtered = out
  }

  let sorted = sortFilteredImeCandidates(filtered, queryNorm, targetSimp, boostHskLevel, targetPinyin).slice(
    0,
    MAX_RESULTS,
  )

  /** Multi-char sentence lookahead: surface the expected phrase when not anti-spoiler-hidden (wrong pinyin recovery). */
  if (
    targetSimp &&
    targetSimp.length > 1 &&
    boostHskLevel != null &&
    boostHskLevel >= 1 &&
    boostHskLevel <= 6 &&
    fullTargetPinyin &&
    !shouldOmitTargetFromCandidates(targetSimp, targetPinyin, queryNorm)
  ) {
    /** @type {CedictEntry | null} */
    let phrase = pickCedictEntryForWord(targetSimp, targetPinyin)
    if (!phrase) {
      const gloss =
        typeof targetEnglish === 'string' && targetEnglish.trim() ? [targetEnglish.trim()] : ['']
      phrase = {
        simplified: targetSimp,
        pinyin: String(targetPinyin),
        english: gloss,
      }
    }
    if (phrase && passesLengthFilter(phrase, queryNorm) && passesQualityFilter(phrase)) {
      sorted = sorted.filter((e) => e.simplified !== phrase.simplified)
      sorted = [phrase, ...sorted]
    }
  }

  /** Exact full input match: always surface the target word as candidate #1 (Characters / Sentences). */
  if (targetSimp && fullTargetPinyin && queryNorm === fullTargetPinyin) {
    sorted = sorted.filter((e) => e.simplified !== targetSimp)
    /** @type {CedictEntry} */
    let entry = pickCedictEntryForWord(targetSimp, targetPinyin)
    if (!entry) {
      const gloss =
        typeof targetEnglish === 'string' && targetEnglish.trim() ? [targetEnglish.trim()] : ['']
      entry = {
        simplified: targetSimp,
        pinyin: String(targetPinyin),
        english: gloss,
      }
    }
    sorted = [entry, ...sorted]
  }

  return sorted
}

export function normalizeQuery(q) {
  return q
    .trim()
    .toLowerCase()
    .replace(/\d/g, '')
    .replace(/ü/g, 'v')
    .replace(/\u00fc/g, 'v')
}

/** Marked vowels / ü (HSK glosses) → plain ASCII letters (ü → v, same as {@link normalizeQuery}). */
const MARKED_PINYIN_CHAR = new Map([
  ['ā', 'a'],
  ['á', 'a'],
  ['ǎ', 'a'],
  ['à', 'a'],
  ['ē', 'e'],
  ['é', 'e'],
  ['ě', 'e'],
  ['è', 'e'],
  ['ī', 'i'],
  ['í', 'i'],
  ['ǐ', 'i'],
  ['ì', 'i'],
  ['ō', 'o'],
  ['ó', 'o'],
  ['ǒ', 'o'],
  ['ò', 'o'],
  ['ū', 'u'],
  ['ú', 'u'],
  ['ǔ', 'u'],
  ['ù', 'u'],
  ['ü', 'v'],
  ['ǖ', 'v'],
  ['ǘ', 'v'],
  ['ǚ', 'v'],
  ['ǜ', 'v'],
])

function stripMarkedPinyinToAscii(s) {
  let out = ''
  for (const ch of s) {
    out += MARKED_PINYIN_CHAR.get(ch) ?? ch
  }
  return out.replace(/\u00fc/g, 'v')
}

/**
 * Concatenated toneless ASCII pinyin (v for ü), for prefix index + learner glosses.
 * Supports CC-CEDICT numbered syllables ("yi1 xia4") and HSK-style marked pinyin ("yīxià", "yī xià").
 */
export function fullTonelessPinyin(pinyinField) {
  if (!pinyinField || typeof pinyinField !== 'string') return ''
  const lower = pinyinField.trim().toLowerCase()
  const stripped = stripMarkedPinyinToAscii(lower)
  return stripped
    .split(/\s+/)
    .map((syl) => syl.replace(/[1-5]$/i, '').replace(/[^a-z]/g, ''))
    .join('')
}

export function isAllHan(s) {
  return typeof s === 'string' && s.length > 0 && /^[\u4e00-\u9fff]+$/u.test(s)
}

export function digitKeyToSlot(key, code) {
  if (key >= '1' && key <= '9') return Number(key) - 1
  const m = /^Numpad([1-9])$/.exec(code)
  return m ? Number(m[1]) - 1 : -1
}
