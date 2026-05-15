/**
 * CC-CEDICT numbered syllables → pinyin with tone marks (v = ü).
 * Placement rules:
 * 1. If the syllable contains 'a' or 'e' → mark on the first 'a', else the first 'e'
 * 2. Else if the syllable contains 'ou' → mark on the 'o' of 'ou'
 * 3. Else → mark on the last vowel (a, e, i, o, u, ü; v counts as ü)
 */

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'ü'])

const TONE_MARKS = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

function applyToneToBaseVowel(base, tone) {
  const row = TONE_MARKS[base]
  if (!row || tone < 1 || tone > 4) return null
  return row[tone - 1]
}

/** Index of the vowel letter that receives the tone mark (lowercase body, ü not v). */
function findToneMarkIndex(body) {
  const s = body.toLowerCase().replace(/v/g, 'ü')

  const ia = s.indexOf('a')
  if (ia !== -1) return ia

  const ie = s.indexOf('e')
  if (ie !== -1) return ie

  const iou = s.indexOf('ou')
  if (iou !== -1) return iou

  for (let i = s.length - 1; i >= 0; i--) {
    if (VOWELS.has(s[i])) return i
  }
  return -1
}

/**
 * One CC-CEDICT syllable with trailing tone digit (1–5), e.g. "ni3", "xue2", "lv3".
 * Neutral tone (5): strip digit only.
 */
export function syllableNumberToMarked(syllable) {
  const m = /^(.+?)([1-5])$/i.exec(syllable.trim())
  if (!m) return syllable

  const tone = Number(m[2])
  const rawBody = m[1]
  const body = rawBody.toLowerCase().replace(/v/g, 'ü')

  if (tone === 5) return body

  const idx = findToneMarkIndex(body)
  if (idx === -1) return body

  const vowel = body[idx]
  const marked = applyToneToBaseVowel(vowel, tone)
  if (!marked) return body

  return body.slice(0, idx) + marked + body.slice(idx + 1)
}

/** Full CC-CEDICT pinyin field (space-separated syllables with digits). */
export function cedictPinyinToMarked(pinyinField) {
  if (!pinyinField || typeof pinyinField !== 'string') return ''
  return pinyinField
    .trim()
    .split(/\s+/)
    .map((syl) => syllableNumberToMarked(syl))
    .join(' ')
}

/**
 * Pinyin for UI: HSK JSON and Cedict often use numbered syllables (e.g. `tong2 xue2`);
 * already tone-marked syllables pass through unchanged.
 * @param {unknown} raw
 */
export function pinyinForDisplay(raw) {
  return cedictPinyinToMarked(String(raw ?? '').trim())
}
