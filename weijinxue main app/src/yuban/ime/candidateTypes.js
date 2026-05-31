import { fullTonelessPinyin, isHeadwordInHskLevel } from '../../utils/pinyinIme.js'

/**
 * @typedef {(
 *   | 'exact_syllable_match'
 *   | 'exact_phrase_match'
 *   | 'expected_answer_match'
 *   | 'expected_answer_partial'
 *   | 'hsk_vocab_match'
 *   | 'warm_vocab_match'
 *   | 'common_vocab_match'
 *   | 'prefix_phrase_match'
 *   | 'rare_dictionary_match'
 * )} CandidateType
 */

/**
 * @param {import('../../utils/pinyinIme.js').CedictEntry} entry
 * @param {string} queryNorm
 * @param {import('./yubanImeContext.js').YubanImeContext & { expectedAnswerTokens: string[] }} ctx
 * @returns {CandidateType[]}
 */
export function classifyCandidateTypes(entry, queryNorm, ctx) {
  /** @type {CandidateType[]} */
  const types = []
  const simp = entry.simplified
  const pin = fullTonelessPinyin(entry.pinyin)
  const len = simp.length
  const exactPinyin = pin === queryNorm
  const startsWithPinyin = pin.startsWith(queryNorm) && !exactPinyin
  const inHsk = isHeadwordInHskLevel(simp, ctx.hskLevel)
  const isExpected = ctx.expectedAnswerTokens.includes(simp)

  if (exactPinyin && len === 1) types.push('exact_syllable_match')
  if (exactPinyin && len > 1) types.push('exact_phrase_match')

  if (isExpected) {
    if (exactPinyin) types.push('expected_answer_match')
    else types.push('expected_answer_partial')
  }

  if (inHsk) types.push('hsk_vocab_match')
  if (ctx.warmHanzi.has(simp)) types.push('warm_vocab_match')
  if (ctx.masteredHanzi.has(simp)) types.push('common_vocab_match')

  if (startsWithPinyin && len > 1) types.push('prefix_phrase_match')
  if (!inHsk && len === 1) types.push('rare_dictionary_match')
  if (!inHsk && len > 1 && !exactPinyin) types.push('rare_dictionary_match')

  return types
}

/**
 * @param {string} queryNorm
 */
export function isOneSyllablePinyinInput(queryNorm) {
  const q = String(queryNorm ?? '').replace(/\s+/g, '')
  if (!q || q.length > 6) return false
  return /^[a-z]+$/.test(q)
}
