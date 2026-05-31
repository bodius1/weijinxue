import { normalizeQuery, fullTonelessPinyin } from '../../utils/pinyinIme.js'

/** @typedef {{ hanzi: string, pinyin: string, pinyinNorm: string }} PhraseCandidate */

/** pinyinNorm (no spaces) → hanzi phrases */
const BEGINNER_PHRASE_MAP = {
  yao: ['要'],
  buyao: ['不要'],
  shi: ['是'],
  shide: ['是的'],
  bushi: ['不是'],
  dui: ['对'],
  budui: ['不对'],
  ele: ['饿了', '饿'],
  e: ['饿'],
  woele: ['我饿了'],
  woyaoshui: ['我要水'],
  woyaoheshui: ['我要喝水'],
  woyaochifan: ['我要吃饭'],
  woxiangchifan: ['我想吃饭'],
  woxiangchimifan: ['我想吃米饭'],
  nihao: ['你好'],
  nihaoma: ['你好吗'],
  zao: ['早'],
  zaoshanghao: ['早上好'],
  xiexie: ['谢谢'],
  bukeqi: ['不客气'],
  woyaoqu: ['我要去'],
  woxiangqu: ['我想去'],
  woyaoqufangjian: ['我要去房间'],
  woxiangqufangjian: ['我想去房间'],
  woyaoqujianshenfang: ['我要去健身房'],
  qujianshenfang: ['去健身房'],
  woyao: ['我要'],
  woxiangchi: ['我想吃'],
  wochile: ['我吃了'],
  buchi: ['不吃'],
  buhe: ['不喝'],
  wobuchi: ['我不吃'],
  wobuhe: ['我不喝'],
  wobuyao: ['我不要'],
}

const PHRASE_PINYIN = {
  饿了: 'è le',
  饿: 'è',
  我饿了: 'wǒ è le',
  我要水: 'wǒ yào shuǐ',
  我要喝水: 'wǒ yào hē shuǐ',
  我要吃饭: 'wǒ yào chī fàn',
  我想吃饭: 'wǒ xiǎng chī fàn',
  我想吃米饭: 'wǒ xiǎng chī mǐfàn',
  你好: 'nǐ hǎo',
  你好吗: 'nǐ hǎo ma',
  早上好: 'zǎo shang hǎo',
  谢谢: 'xièxie',
  不客气: 'bù kèqi',
  我要去: 'wǒ yào qù',
  我想去: 'wǒ xiǎng qù',
  我要去房间: 'wǒ yào qù fángjiān',
  我想去房间: 'wǒ xiǎng qù fángjiān',
  我要去健身房: 'wǒ yào qù jiànshēnfáng',
  去健身房: 'qù jiànshēnfáng',
  我要: 'wǒ yào',
  不要: 'bù yào',
  是的: 'shì de',
  不是: 'bù shì',
  对: 'duì',
  不对: 'bù duì',
  要: 'yào',
  早: 'zǎo',
  吃: 'chī',
  喝: 'hē',
  不吃: 'bù chī',
  不喝: 'bù hē',
  我不要: 'wǒ bù yào',
  我不吃: 'wǒ bù chī',
  我不喝: 'wǒ bù hē',
  我想吃: 'wǒ xiǎng chī',
}

/**
 * @param {string} raw
 */
export function normalizePhraseQuery(raw) {
  return normalizeQuery(raw).replace(/\s+/g, '')
}

/**
 * @param {string} hanzi
 * @param {string} [pinyin]
 */
function phraseEntry(hanzi, pinyin = '') {
  const pin = pinyin || hanzi
  return {
    hanzi,
    pinyin: pin,
    pinyinNorm: fullTonelessPinyin(pin) || normalizePhraseQuery(pin),
  }
}

/**
 * Context-aware phrase boosts from NPC line + task.
 * @param {string} blob
 * @returns {PhraseCandidate[]}
 */
function contextPhrases(blob) {
  /** @type {PhraseCandidate[]} */
  const out = []
  const add = (hanzi, pin) => {
    const e = phraseEntry(hanzi, pin)
    if (!out.some((x) => x.hanzi === e.hanzi)) out.push(e)
  }

  if (/你好|欢迎|打招呼|greeting/i.test(blob)) {
    add('你好', 'nǐ hǎo')
    add('你好吗', 'nǐ hǎo ma')
    add('嗨', 'hāi')
    add('早上好', 'zǎo shang hǎo')
    add('早', 'zǎo')
  }
  if (/吃饭|吃吗|chī fàn/i.test(blob)) {
    add('要', 'yào')
    add('不要', 'bù yào')
    add('吃', 'chī')
    add('我饿了', 'wǒ è le')
    add('饿了', 'è le')
    add('我要吃饭', 'wǒ yào chī fàn')
    add('是的', 'shì de')
    add('对', 'duì')
  }
  if (/喝水|喝.*吗|hē shuǐ/i.test(blob)) {
    add('要', 'yào')
    add('不要', 'bù yào')
    add('我要喝水', 'wǒ yào hē shuǐ')
    add('我要水', 'wǒ yào shuǐ')
    add('喝', 'hē')
  }
  if (/要.*吗|yes.*no|要不要/i.test(blob)) {
    add('要', 'yào')
    add('不要', 'bù yào')
    add('是的', 'shì de')
    add('对', 'duì')
  }
  return out
}

/**
 * @param {string} queryNorm
 * @param {import('./yubanImeContext.js').YubanImeContext | null} ctx
 * @param {number} hskLevel
 * @returns {PhraseCandidate[]}
 */
export function buildPhraseCandidates(queryNorm, ctx, hskLevel) {
  if (!queryNorm || hskLevel > 2) return []

  const q = normalizePhraseQuery(queryNorm)
  /** @type {PhraseCandidate[]} */
  const results = []
  const seen = new Set()

  const push = (/** @type {PhraseCandidate} */ entry) => {
    if (!entry.hanzi || seen.has(entry.hanzi)) return
    const pin = entry.pinyinNorm || fullTonelessPinyin(entry.pinyin)
    const matches = pin === q || pin.startsWith(q) || q.startsWith(pin)
    if (!matches) return
    seen.add(entry.hanzi)
    results.push({ ...entry, pinyinNorm: pin })
  }

  const blob = [
    ctx?.productionPrompt,
    ctx?.expectedHint,
    ctx?.npcDialogueHanzi,
  ]
    .filter(Boolean)
    .join(' ')

  for (const p of contextPhrases(blob)) {
    push(p)
  }

  const staticList = BEGINNER_PHRASE_MAP[q] ?? []
  for (const hanzi of staticList) {
    push(phraseEntry(hanzi, PHRASE_PINYIN[hanzi] ?? hanzi))
  }

  for (const [key, list] of Object.entries(BEGINNER_PHRASE_MAP)) {
    if (key.startsWith(q) && key !== q) {
      for (const hanzi of list) {
        push(phraseEntry(hanzi, PHRASE_PINYIN[hanzi] ?? key))
      }
    }
  }

  for (const token of ctx?.expectedAnswerTokens ?? []) {
    const pin = fullTonelessPinyin(token)
    if (pin === q || pin.startsWith(q) || q.startsWith(pin)) {
      push(phraseEntry(token, token))
    }
  }

  return results.sort((a, b) => {
    const exactA = a.pinyinNorm === q ? 1 : 0
    const exactB = b.pinyinNorm === q ? 1 : 0
    if (exactB !== exactA) return exactB - exactA
    const lenA = a.hanzi.length === 1 ? 0 : 1
    const lenB = b.hanzi.length === 1 ? 0 : 1
    if (a.pinyinNorm === q && b.pinyinNorm === q) return lenB - lenA
    return a.hanzi.length - b.hanzi.length
  })
}

/**
 * Split dictionary candidates vs pedagogical phrases for UI rows.
 * @param {import('../../utils/pinyinIme.js').CedictEntry[]} dictRanked
 * @param {PhraseCandidate[]} phrases
 * @param {string} queryNorm
 */
export function splitDisplayCandidates(dictRanked, phrases, queryNorm) {
  const q = normalizePhraseQuery(queryNorm)
  const exactPhrases = phrases.filter((p) => p.pinyinNorm === q)
  const prefixPhrases = phrases.filter((p) => p.pinyinNorm !== q && p.pinyinNorm.startsWith(q))

  const singles = dictRanked.filter((e) => e.simplified.length === 1)
  const mainCandidates =
    singles.length > 0 ? singles : dictRanked.filter((e) => fullTonelessPinyin(e.pinyin) === q).slice(0, 6)

  const phraseCandidates = [...exactPhrases, ...prefixPhrases].filter(
    (p) => p.hanzi.length > 1 || exactPhrases.some((e) => e.hanzi === p.hanzi),
  )

  return {
    mainCandidates: mainCandidates.slice(0, 4),
    phraseCandidates: phraseCandidates.slice(0, 6),
  }
}
