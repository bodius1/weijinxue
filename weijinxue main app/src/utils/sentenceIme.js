/**
 * Sentence Type tab: IME candidates prioritised by the displayed sentence (per-cell `py` from sentence JSON).
 */

import { MAX_RESULTS, fullTonelessPinyin, pickCedictEntryForWord } from './pinyinIme.js'

/** @typedef {{ simplified: string, pinyin: string, english: string[] }} CedictEntry */

/**
 * Han-only substring from the active cell to the end of the line (punctuation skipped).
 * Used so candidates cannot include characters already typed before the cursor.
 */
export function getRemainingHanTextFromActive(sentenceLine, active) {
  const cells = Array.isArray(sentenceLine?.cells) ? sentenceLine.cells : []
  const start =
    active?.cell?.kind === 'han' && Number.isInteger(active.cellIndex) && active.cellIndex >= 0
      ? active.cellIndex
      : 0
  let out = ''
  for (let i = start; i < cells.length; i += 1) {
    const c = cells[i]
    if (c.kind === 'han') out += String(c.expect ?? '')
  }
  return out
}

/**
 * True iff this candidate text is a contiguous prefix of the remaining sentence Han from the active index.
 */
export function isAnchoredSentenceCandidate(candidateSimplified, remainingHan) {
  const cand = String(candidateSimplified ?? '').trim()
  const rem = String(remainingHan ?? '')
  if (!cand || !rem) return false
  return rem.startsWith(cand)
}

/**
 * Toneless ASCII pinyin for a CC-CEDICT or sentence row `pinyin` field (digits/marked vowels stripped, no spaces).
 * Same rules as {@link fullTonelessPinyin} in pinyinIme.js.
 */
export function normalizeSentenceCandidatePinyin(pinyinField) {
  return fullTonelessPinyin(String(pinyinField ?? ''))
}

/**
 * Loose compatibility for single-syllable / global rows: exact, or one toneless string extends the other.
 * Rejects unrelated strings (e.g. `wanan` vs `wanshang`, `buyaonage` vs `buyaozhege`).
 */
export function pinyinTripletCompatible(candidatePyNorm, queryNorm) {
  const c = String(candidatePyNorm ?? '').trim()
  const q = String(queryNorm ?? '').trim()
  if (!c || !q) return false
  return c === q || c.startsWith(q) || q.startsWith(c)
}

/**
 * Sentence Type **global** CC-CEDICT fallback: Han anchor + pinyin rules.
 * Multi-Han entries cannot pass on `candidatePy.startsWith(query)` alone (prevents `qing` → long 请再说一遍 from globals).
 *
 * @param {CedictEntry} entry
 * @param {string} queryNorm
 * @param {string} remainingHan from {@link getRemainingHanTextFromActive}
 */
export function isGlobalSentenceFallbackCompatible(entry, queryNorm, remainingHan) {
  const simplified = String(entry?.simplified ?? '').trim()
  const rem = String(remainingHan ?? '')
  if (!simplified || !rem.startsWith(simplified)) return false

  const pyNorm = normalizeSentenceCandidatePinyin(entry?.pinyin ?? '')
  const q = String(queryNorm ?? '').trim()
  if (!pyNorm || !q) return false

  const hanLength = [...simplified].filter((ch) => /[\u3400-\u9FFF]/u.test(ch)).length

  if (hanLength <= 1) {
    return pinyinTripletCompatible(pyNorm, q)
  }

  return pyNorm === q || q.startsWith(pyNorm)
}

/**
 * Stricter match for **anchored sentence spans** (longer Han must not match on only the first syllable).
 * @param {string} pyNorm toneless span from sentence `py`
 * @param {string} queryNorm
 * @param {string} prevSpanPyNorm toneless pinyin of the immediately shorter span (empty for the first span)
 * @returns {'exact' | 'typed-beyond' | 'partial-into' | 'none'}
 */
export function classifySentenceSpanMatch(pyNorm, queryNorm, prevSpanPyNorm) {
  const py = String(pyNorm ?? '')
  const q = String(queryNorm ?? '')
  if (!q || !py) return 'none'
  if (py === q) return 'exact'
  if (q.startsWith(py)) return 'typed-beyond'
  const prevLen = String(prevSpanPyNorm ?? '').length
  if (prevLen > 0 && py.startsWith(q) && q.length > prevLen) return 'partial-into'
  return 'none'
}

const SPAN_MATCH_ORDER = { exact: 4, 'partial-into': 3, 'typed-beyond': 2, none: 0 }

function compareSpanMetaByRank(
  /** @type {{ han: string, pyNorm: string, matchType: string }} */ a,
  /** @type {{ han: string, pyNorm: string, matchType: string }} */ b,
) {
  const ra = SPAN_MATCH_ORDER[a.matchType] ?? 0
  const rb = SPAN_MATCH_ORDER[b.matchType] ?? 0
  if (ra !== rb) return rb - ra
  if (a.matchType === 'exact' && b.matchType === 'exact') return b.han.length - a.han.length
  if (a.matchType === 'partial-into' && b.matchType === 'partial-into') return b.han.length - a.han.length
  if (a.matchType === 'typed-beyond' && b.matchType === 'typed-beyond') return a.han.length - b.han.length
  return 0
}

/**
 * True if the cell's `py` is compatible with `queryNorm` (triplet on toneless syllable).
 * @param {string} cellPy e.g. `men5`, `wen2`
 * @param {string} queryNorm normalized IME query (tone digits stripped)
 */
export function sentenceSyllableMatchesQuery(cellPy, queryNorm) {
  if (!queryNorm) return false
  const t = fullTonelessPinyin(String(cellPy ?? ''))
  return pinyinTripletCompatible(t, queryNorm)
}

/**
 * Multi-character (and single-character) phrase candidates from consecutive Han cells starting at `sentActive`,
 * using per-cell `py` from the sentence row. Toneless syllables are concatenated (e.g. ni + jiao → nijiao).
 * Does not use CC-CEDICT to invent these strings.
 *
 * @param {{ cells: { kind: string, expect?: string, py?: string, state?: string }[], english?: string }} sentenceLine
 * @param {{ cellIndex: number, cell: { kind: string, expect?: string, py?: string, state?: string } } | null} active
 * @param {string} queryNorm normalized IME query (see `normalizeQuery` in pinyinIme.js)
 * @returns {CedictEntry[]}
 */
export function buildAnchoredSentenceSpanCandidates(sentenceLine, active, queryNorm) {
  if (!queryNorm || !sentenceLine?.cells?.length) return []

  const cells = sentenceLine.cells
  const start =
    active?.cell?.kind === 'han' && Number.isInteger(active.cellIndex) && active.cellIndex >= 0
      ? active.cellIndex
      : 0

  const remainingHan = getRemainingHanTextFromActive(sentenceLine, active)
  const eng =
    typeof sentenceLine.english === 'string' && sentenceLine.english.trim()
      ? [sentenceLine.english.trim()]
      : ['']

  /** @type {{ han: string, pyNorm: string, pinyin: string, matchType: string }[]} */
  const metas = []
  let han = ''
  let prevSpanPyNorm = ''
  for (let i = start; i < cells.length; i += 1) {
    const c = cells[i]
    if (c.kind !== 'han') break
    const ch = String(c.expect ?? '').trim()
    const cpy = String(c.py ?? '').trim()
    if (!ch || !cpy) break
    han += ch
    if (!isAnchoredSentenceCandidate(han, remainingHan)) break

    let pyNorm = ''
    for (let j = start; j <= i; j += 1) {
      const cc = cells[j]
      if (cc.kind !== 'han') break
      pyNorm += fullTonelessPinyin(String(cc.py ?? ''))
    }
    const matchType = classifySentenceSpanMatch(pyNorm, queryNorm, prevSpanPyNorm)
    if (matchType !== 'none') {
      const pinyinMarked = cells
        .slice(start, i + 1)
        .filter((x) => x.kind === 'han')
        .map((x) => String(x.py ?? '').trim())
        .filter(Boolean)
        .join(' ')
      metas.push({ han, pyNorm, pinyin: pinyinMarked || pyNorm, matchType })
    }
    prevSpanPyNorm = pyNorm
  }

  metas.sort(compareSpanMetaByRank)

  /** @type {CedictEntry[]} */
  const out = []
  const seen = new Set()
  for (const m of metas) {
    if (seen.has(m.han)) continue
    seen.add(m.han)
    let e = pickCedictEntryForWord(m.han, m.pinyin)
    if (!e) {
      e = { simplified: m.han, pinyin: m.pinyin, english: eng }
    } else if (!e.english?.length) {
      e = { ...e, english: eng }
    }
    out.push(e)
  }
  return out
}

/**
 * @param {string} expect
 * @param {string} cellPy
 * @returns {CedictEntry}
 */
function entryForSentenceChar(expect, cellPy) {
  const ch = String(expect ?? '').trim()
  const py = String(cellPy ?? '').trim()
  const ced = pickCedictEntryForWord(ch, py)
  if (ced) return ced
  return {
    simplified: ch,
    pinyin: py || ch,
    english: [''],
  }
}

/**
 * Sentence Type IME: (1) anchored multi-Han spans from the sentence row (toneless pinyin built from `py`),
 * (2) single-cell sentence matches from the active index, (3) global CC-CEDICT via {@link isGlobalSentenceFallbackCompatible}.
 *
 * @param {{ cells: { kind: string, expect?: string, py?: string, state?: string }[] }} sentenceLine Row that contains the active cell (the sentence currently being typed)
 * @param {{ cellIndex: number, cell: { kind: string, expect?: string, py?: string, state?: string } } | null} active Active cell from `findActiveSentenceCell`
 * @param {string} queryNorm
 * @param {CedictEntry[]} globalCandidates from `lookupFromIndex`
 */
export function mergeSentenceContextCandidates(sentenceLine, active, queryNorm, globalCandidates) {
  if (!queryNorm || !sentenceLine?.cells?.length) return globalCandidates

  const remainingHan = getRemainingHanTextFromActive(sentenceLine, active)

  /** @type {CedictEntry[]} */
  const sentenceFirst = []
  /** @type {Map<string, CedictEntry>} */
  const bySimp = new Map()

  const pushUniqueAnchored = (/** @type {CedictEntry} */ e) => {
    if (!e?.simplified) return
    if (bySimp.has(e.simplified)) return
    if (!isAnchoredSentenceCandidate(e.simplified, remainingHan)) return
    bySimp.set(e.simplified, e)
    sentenceFirst.push(e)
  }

  const activeIdx =
    active?.cell?.kind === 'han' && Number.isInteger(active.cellIndex) && active.cellIndex >= 0
      ? active.cellIndex
      : 0

  for (const e of buildAnchoredSentenceSpanCandidates(sentenceLine, active, queryNorm)) {
    pushUniqueAnchored(e)
  }

  /** @type {{ idx: number, entry: CedictEntry }[]} */
  const matches = []
  for (let i = activeIdx; i < sentenceLine.cells.length; i += 1) {
    const c = sentenceLine.cells[i]
    if (c.kind !== 'han') continue
    if (c.state === 'correct') continue
    if (!sentenceSyllableMatchesQuery(c.py, queryNorm)) continue
    matches.push({ idx: i, entry: entryForSentenceChar(c.expect, c.py) })
  }

  matches.sort((a, b) => a.idx - b.idx)
  for (const m of matches) pushUniqueAnchored(m.entry)

  /** @type {CedictEntry[]} */
  const out = [...sentenceFirst]
  for (const e of globalCandidates) {
    if (out.length >= MAX_RESULTS) break
    if (!e?.simplified || bySimp.has(e.simplified)) continue
    if (!isGlobalSentenceFallbackCompatible(e, queryNorm, remainingHan)) continue
    bySimp.set(e.simplified, e)
    out.push(e)
  }
  return out
}

/**
 * Manual regression (Type → Sentences): confirm in the running app.
 *
 * 1. 我们走吧。 After 我 is correct, type `men` → 们 is candidate #1; not 我们.
 * 2. 你会说中文吗？ With 文 active, type `wen` → 文 is #1.
 * 3. 现在几点？ With 几 active, type `ji` → 几 is #1.
 * 4. 请等一下。 After 请, `dengyixia` / 等一下 OK; 请等一下 must not appear. After 请等, `yixia` / 一下 OK; not 等一下 / 请等一下.
 * 5. 你会说中文吗？ After 你会说, `zhongwen` → 中文 OK; not 你会说中文.
 * 6. 学习中文。 After 学, `xi` → 习 first; not 学习. At 学, `xuexizhongwen` → 学习中文 #1.
 * 7. 你叫什么名字？ At 你, `nijiaoshenmemingzi` → 你叫什么名字 #1; after 你, `jiaoshenmemingzi` → 叫什么名字 (not 你叫什么名字).
 * 8. 不要那个。 `buyaozhege` → not 不要那个; `buyaonage` → 不要那个 #1.
 * 9. 请再说一遍。 `qing` → 请 #1; long global 请再说一遍 must not pass on `py.startsWith(qing)` alone. `qingzai` → 请再 (spans). `qingzaishuoyibian` → full phrase.
 * 10. 晚安。 `wanan` → 晚安; `wanshang` → not 晚安 (triplet fails).
 * 11. Multiple lines: IME row follows `getSentenceLineForTypingIme` in TypeTab (today always line 0).
 */
export const getSentenceContextCandidates = mergeSentenceContextCandidates
