import {
  fullTonelessPinyin,
  isHeadwordInHskLevel,
  pickCedictEntryForWord,
  HSK_DATA,
} from '../../utils/pinyinIme.js'
import { classifyCandidateTypes, isOneSyllablePinyinInput } from './candidateTypes.js'

/**
 * @typedef {import('./yubanImeContext.js').YubanImeContext} YubanImeContext
 */

/**
 * @param {import('../../utils/pinyinIme.js').CedictEntry} entry
 */
function pinyinNorm(entry) {
  return fullTonelessPinyin(entry.pinyin)
}

/**
 * @param {string} hanzi
 * @param {number} hskLevel
 * @returns {import('../../utils/pinyinIme.js').CedictEntry | null}
 */
function entryForHanzi(hanzi, hskLevel) {
  const s = String(hanzi).trim()
  if (!s) return null
  const fromDict = pickCedictEntryForWord(s, '')
  if (fromDict) return fromDict

  const arr = HSK_DATA[hskLevel - 1] ?? []
  for (const raw of arr) {
    if (String(raw?.simplified ?? '').trim() === s) {
      return {
        simplified: s,
        pinyin: String(raw?.pinyin ?? '').trim(),
        english: [String(raw?.english ?? '').trim()].filter(Boolean),
      }
    }
  }
  return { simplified: s, pinyin: s, english: [''] }
}

/**
 * @param {import('../../utils/pinyinIme.js').CedictEntry[]} candidates
 * @param {string} queryNorm
 * @param {YubanImeContext} ctx
 */
function injectContextPhrases(candidates, queryNorm, ctx) {
  const seen = new Set(candidates.map((e) => e.simplified))
  /** @type {import('../../utils/pinyinIme.js').CedictEntry[]} */
  const injected = []

  const toInject = [
    ...ctx.expectedAnswerTokens,
    ...(ctx.phraseByQueryPrefix.get(queryNorm) ?? []),
    ...(ctx.syllableBoosts[queryNorm] ?? []),
  ]

  const inputOneSyl = isOneSyllablePinyinInput(queryNorm)

  for (const hanzi of toInject) {
    if (!hanzi || seen.has(hanzi)) continue
    const entry = entryForHanzi(hanzi, ctx.hskLevel)
    if (!entry) continue
    const pin = pinyinNorm(entry)
    const len = entry.simplified.length
    const exact = pin === queryNorm
    const inputCovers = queryNorm.startsWith(pin) && pin.length > 0
    const prefix = pin.startsWith(queryNorm) && !exact

    if (inputOneSyl && len > 1 && !exact) continue
    if (!exact && !prefix && !inputCovers) continue
    injected.push(entry)
    seen.add(hanzi)
  }

  return [...injected, ...candidates]
}

/**
 * Higher score = rank first.
 * @param {import('../../utils/pinyinIme.js').CedictEntry} entry
 * @param {string} queryNorm
 * @param {YubanImeContext} ctx
 */
export function scoreYubanCandidate(entry, queryNorm, ctx) {
  const simp = entry.simplified
  const pin = pinyinNorm(entry)
  const len = simp.length
  const inputOneSyl = isOneSyllablePinyinInput(queryNorm)
  const exactPinyin = pin === queryNorm
  const startsWithPinyin = pin.startsWith(queryNorm) && !exactPinyin
  const inHsk = isHeadwordInHskLevel(simp, ctx.hskLevel)
  const isExpected = ctx.expectedAnswerTokens.includes(simp)

  let score = 0

  if (isExpected && exactPinyin) score += 10000
  else if (isExpected && !inputOneSyl) score += 8500
  else if (isExpected && inputOneSyl && len > 1) score += 400

  if (exactPinyin) score += 8000
  else if (startsWithPinyin) score += 100

  if (inputOneSyl && len === 1 && exactPinyin) score += 3000

  if (inHsk && ctx.hskLevel <= 2) score += 2000
  else if (inHsk) score += 1200

  if (ctx.warmHanzi.has(simp)) score += 1000
  if (ctx.masteredHanzi.has(simp)) score += 500
  if (ctx.taskHanzi.has(simp)) score += 800

  const boosts = ctx.syllableBoosts[queryNorm] ?? []
  const boostIdx = boosts.indexOf(simp)
  if (boostIdx >= 0) score += 1500 - boostIdx * 40

  if (!inHsk) score -= 1000

  if (inputOneSyl && len > 1 && !exactPinyin) score -= 2500
  if (inputOneSyl && len > 1 && startsWithPinyin) score -= 2200

  if (len > 1 && !exactPinyin && !isExpected) score -= Math.min(len * 120, 600)

  return score
}

/**
 * HSK 1–2 one-syllable guard: exact single-char matches before prefix phrases.
 * @param {import('../../utils/pinyinIme.js').CedictEntry[]} sorted
 * @param {string} queryNorm
 * @param {YubanImeContext} ctx
 */
function applyBeginnerSyllableGuard(sorted, queryNorm, ctx) {
  if (ctx.hskLevel > 2 || !isOneSyllablePinyinInput(queryNorm)) return sorted

  /** @type {import('../../utils/pinyinIme.js').CedictEntry[]} */
  const exactSingle = []
  /** @type {import('../../utils/pinyinIme.js').CedictEntry[]} */
  const exactExpectedPhrase = []
  /** @type {import('../../utils/pinyinIme.js').CedictEntry[]} */
  const rest = []

  for (const e of sorted) {
    const pin = pinyinNorm(e)
    const exact = pin === queryNorm
    if (e.simplified.length === 1 && exact) {
      exactSingle.push(e)
    } else if (ctx.expectedAnswerTokens.includes(e.simplified) && exact) {
      exactExpectedPhrase.push(e)
    } else {
      rest.push(e)
    }
  }

  if (!exactSingle.length) return sorted
  return [...exactSingle, ...exactExpectedPhrase, ...rest]
}

/**
 * @param {import('../../utils/pinyinIme.js').CedictEntry[]} candidates
 * @param {string} queryNorm
 * @param {YubanImeContext | null | undefined} ctx
 */
export function rankYubanCandidates(candidates, queryNorm, ctx) {
  if (!queryNorm || !candidates.length) return candidates
  if (!ctx) return candidates

  const q = queryNorm.replace(/\s+/g, '')
  let list = injectContextPhrases([...candidates], q, ctx)

  list = [...list].sort((a, b) => {
    const sa = scoreYubanCandidate(a, q, ctx)
    const sb = scoreYubanCandidate(b, q, ctx)
    if (sb !== sa) return sb - sa
    const exactA = pinyinNorm(a) === q ? 1 : 0
    const exactB = pinyinNorm(b) === q ? 1 : 0
    if (exactB !== exactA) return exactB - exactA
    return a.simplified.length - b.simplified.length
  })

  list = applyBeginnerSyllableGuard(list, q, ctx)

  const seen = new Set()
  /** @type {import('../../utils/pinyinIme.js').CedictEntry[]} */
  const deduped = []
  for (const e of list) {
    if (seen.has(e.simplified)) continue
    seen.add(e.simplified)
    deduped.push(e)
  }
  return deduped
}

export { classifyCandidateTypes, isOneSyllablePinyinInput }
