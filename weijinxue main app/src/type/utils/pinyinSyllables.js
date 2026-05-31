import { stripTones } from '../hooks/usePinyinStream.js'
import { fullTonelessPinyin, pickCedictEntryForWord } from '../../utils/pinyinIme.js'

const PUNCTUATION = /[，。！？、；：""''「」【】《》\s.,!?;:'"()[\]\-—…·]/u
const AUTO_SKIP = /[0-9A-Za-z]/u
const HAN = /[\u4e00-\u9fff]/u

/**
 * Toneless syllable for stream typing — one Han character at a time.
 * Prefers CC-CEDICT per-character lookup so bad/empty `py` cells still work.
 * @param {string} hanChar
 * @param {string} [pyFromCell]
 */
export function resolveStreamSyllable(hanChar, pyFromCell = '') {
  const ch = String(hanChar ?? '').trim()
  if (!ch || !HAN.test(ch)) return ''

  if (ch.length === 1) {
    const entry = pickCedictEntryForWord(ch, '')
    if (entry?.pinyin) {
      const first = entry.pinyin.trim().split(/\s+/)[0] ?? ''
      const fromDict = fullTonelessPinyin(first) || stripTones(first)
      if (fromDict) return fromDict
    }
  }

  return stripTones(pyFromCell)
}

/**
 * @param {string} sentence
 * @param {(char: string) => string | null | undefined} getPinyin
 */
export function extractSyllables(sentence, getPinyin) {
  const syllables = []
  const charIndices = []

  for (let i = 0; i < sentence.length; i += 1) {
    const char = sentence[i]
    if (PUNCTUATION.test(char) || AUTO_SKIP.test(char)) continue
    if (!HAN.test(char)) continue

    const hinted = getPinyin?.(char) ?? ''
    const syl = resolveStreamSyllable(char, hinted)
    if (!syl) continue

    syllables.push(syl)
    charIndices.push(i)
  }

  return { syllables, charIndices }
}

/**
 * Preferred for Type tab sentences — aligns cells to `chinese` string positions.
 * @param {{ chinese: string, cells: Array<{ kind: string, expect?: string, py?: string, ch?: string }> }} line
 */
export function extractSyllablesFromSentLine(line) {
  const syllables = []
  const charIndices = []
  const chinese = String(line?.chinese ?? '')
  const cells = line?.cells ?? []

  let charPos = 0
  for (const cell of cells) {
    if (cell.kind === 'punct') {
      while (charPos < chinese.length && chinese[charPos] !== cell.ch) {
        const c = chinese[charPos]
        if (HAN.test(c)) break
        charPos += 1
      }
      if (charPos < chinese.length && chinese[charPos] === cell.ch) charPos += 1
      continue
    }

    if (cell.kind === 'han') {
      while (charPos < chinese.length && chinese[charPos] !== cell.expect) {
        const c = chinese[charPos]
        if (PUNCTUATION.test(c) || AUTO_SKIP.test(c)) {
          charPos += 1
          continue
        }
        break
      }

      if (charPos < chinese.length && chinese[charPos] === cell.expect) {
        const syl = resolveStreamSyllable(cell.expect, cell.py ?? '')
        if (syl) {
          syllables.push(syl)
          charIndices.push(charPos)
        }
        charPos += 1
      }
    }
  }

  return { syllables, charIndices }
}

export { PUNCTUATION, AUTO_SKIP }
