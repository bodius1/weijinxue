/** @typedef {{ hanzi: string, pinyin: string, english: string, note: string }} NormalizedAlternative */

const HSK1_GLOSS = {
  要: { pinyin: 'yào', english: 'want / yes' },
  不要: { pinyin: 'bù yào', english: "don't want / no" },
  是: { pinyin: 'shì', english: 'yes / to be' },
  是的: { pinyin: 'shì de', english: "yes (that's right)" },
  对: { pinyin: 'duì', english: 'right / correct' },
  不: { pinyin: 'bù', english: 'not / no' },
  你好: { pinyin: 'nǐ hǎo', english: 'hello' },
  你好吗: { pinyin: 'nǐ hǎo ma', english: 'how are you?' },
  谢谢: { pinyin: 'xièxie', english: 'thank you' },
  早: { pinyin: 'zǎo', english: 'morning (short)' },
  早上好: { pinyin: 'zǎoshang hǎo', english: 'good morning' },
  我饿了: { pinyin: 'wǒ è le', english: "I'm hungry" },
  我要喝水: { pinyin: 'wǒ yào hē shuǐ', english: 'I want to drink water' },
  我要水: { pinyin: 'wǒ yào shuǐ', english: 'I want water' },
  我要喝茶: { pinyin: 'wǒ yào hē chá', english: 'I want to drink tea' },
  我要吃饭: { pinyin: 'wǒ yào chī fàn', english: 'I want to eat' },
  我要米饭: { pinyin: 'wǒ yào mǐfàn', english: 'I want rice' },
}

/**
 * @param {string} hanzi
 */
export function inferPinyinIfPossible(hanzi) {
  return HSK1_GLOSS[hanzi]?.pinyin ?? ''
}

/**
 * @param {string} hanzi
 */
export function inferEnglishIfPossible(hanzi) {
  return HSK1_GLOSS[hanzi]?.english ?? ''
}

/**
 * @param {unknown} alt
 * @returns {NormalizedAlternative | null}
 */
export function normalizeOneAlternative(alt) {
  if (alt == null) return null

  if (typeof alt === 'string') {
    const hanzi = alt.trim()
    if (!hanzi) return null
    return {
      hanzi,
      pinyin: inferPinyinIfPossible(hanzi),
      english: inferEnglishIfPossible(hanzi),
      note: '',
    }
  }

  if (typeof alt !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (alt)
  const hanzi = String(o.hanzi ?? o.text ?? o.simplified ?? '').trim()
  if (!hanzi) return null

  const pinyin = String(o.pinyin ?? '').trim() || inferPinyinIfPossible(hanzi)
  const english =
    String(o.english ?? o.translation ?? o.meaning ?? '').trim() || inferEnglishIfPossible(hanzi)
  const note = String(o.note ?? o.label ?? '').trim()

  return { hanzi, pinyin, english, note }
}

/**
 * @param {unknown} alternatives
 * @returns {NormalizedAlternative[]}
 */
export function normalizeAlternatives(alternatives) {
  if (!Array.isArray(alternatives)) return []
  const out = []
  const seen = new Set()
  for (const alt of alternatives) {
    const norm = normalizeOneAlternative(alt)
    if (!norm?.hanzi || seen.has(norm.hanzi)) continue
    seen.add(norm.hanzi)
    out.push(norm)
  }
  return out
}
