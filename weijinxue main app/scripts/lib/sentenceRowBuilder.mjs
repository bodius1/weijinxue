/**
 * Build sentence rows for Type → Sentences JSON (chinese, english, pinyin, parts, py).
 */

const TONE_FROM_MARK = new Map([
  ['ā', 1], ['á', 2], ['ǎ', 3], ['à', 4],
  ['ē', 1], ['é', 2], ['ě', 3], ['è', 4],
  ['ī', 1], ['í', 2], ['ǐ', 3], ['ì', 4],
  ['ō', 1], ['ó', 2], ['ǒ', 3], ['ò', 4],
  ['ū', 1], ['ú', 2], ['ǔ', 3], ['ù', 4],
  ['ǖ', 1], ['ǘ', 2], ['ǚ', 3], ['ǜ', 4],
])

const BASE_VOWEL = new Map([
  ['ā', 'a'], ['á', 'a'], ['ǎ', 'a'], ['à', 'a'],
  ['ē', 'e'], ['é', 'e'], ['ě', 'e'], ['è', 'e'],
  ['ī', 'i'], ['í', 'i'], ['ǐ', 'i'], ['ì', 'i'],
  ['ō', 'o'], ['ó', 'o'], ['ǒ', 'o'], ['ò', 'o'],
  ['ū', 'u'], ['ú', 'u'], ['ǔ', 'u'], ['ù', 'u'],
  ['ǖ', 'ü'], ['ǘ', 'ü'], ['ǚ', 'ü'], ['ǜ', 'ü'],
])

const MARKED_SYLLABLE_RE =
  /[bpmfdtnlgkhjqxrzcsyw]?(?:(?:[aeiouüv]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ][aeiouüv]*)|(?:[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+))(?:ng|n)?/gi

/** @param {string} marked */
export function splitMarkedSyllables(marked) {
  return String(marked ?? '')
    .match(MARKED_SYLLABLE_RE)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? []
}

/** @param {string} syl */
export function markedSyllableToNumbered(syl) {
  let tone = 5
  let body = ''
  for (const ch of syl) {
    const t = TONE_FROM_MARK.get(ch)
    if (t != null) {
      tone = t
      body += BASE_VOWEL.get(ch) ?? ch
    } else {
      body += ch.toLowerCase()
    }
  }
  body = body.replace(/ü/g, 'v')
  return tone === 5 ? body : `${body}${tone}`
}

/** @param {string} marked */
export function markedToNumberedList(marked) {
  return splitMarkedSyllables(marked).map(markedSyllableToNumbered)
}

/** @param {string} text @param {string[]} vocab */
export function tokenizeHan(text, vocab) {
  const words = [...vocab].sort((a, b) => b.length - a.length)
  /** @type {string[]} */
  const tokens = []
  for (let i = 0; i < text.length; ) {
    const ch = text[i]
    if (!/[\u4e00-\u9fff]/u.test(ch)) {
      i += 1
      continue
    }
    let matched = ''
    for (const w of words) {
      if (text.startsWith(w, i)) {
        matched = w
        break
      }
    }
    if (matched) {
      tokens.push(matched)
      i += matched.length
    } else {
      tokens.push(ch)
      i += 1
    }
  }
  return tokens
}

/** @param {string} token @param {Map<string, { pinyin: string }>} hskMap */
function perCharPyFromHsk(token, hskMap) {
  const entry = hskMap.get(token)
  if (!entry) return null
  const chars = [...token]
  const sylls = markedToNumberedList(entry.pinyin)
  if (sylls.length === chars.length) return sylls
  if (chars.length === 1 && sylls.length >= 1) {
    const tone = sylls[0].match(/[1-5]$/)?.[0] ?? '5'
    const base = sylls.map((s) => s.replace(/[1-5]$/, '')).join('')
    return [base + tone]
  }
  return null
}

/**
 * @param {string} chinese
 * @param {string} markedPinyin
 * @param {string} english
 * @param {Map<string, { pinyin: string }>} hskMap
 */
export function buildRow(chinese, markedPinyin, english, hskMap) {
  const vocab = [...hskMap.keys()]
  const tokens = tokenizeHan(chinese, vocab)
  const pyGroups = markedPinyin
    .replace(/[“”"':]/g, ' ')
    .replace(/[!.?,，。！？、；：]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  /** @type {string[]} */
  const pyParts = []
  let gi = 0
  for (const token of tokens) {
    const group = pyGroups[gi] ?? ''
    gi += 1
    const fromHsk = perCharPyFromHsk(token, hskMap)
    if (fromHsk) {
      pyParts.push(...fromHsk)
      continue
    }
    const sylls = markedToNumberedList(group)
    const chars = [...token]
    if (sylls.length === chars.length) {
      pyParts.push(...sylls)
    } else if (chars.length === 1) {
      pyParts.push(sylls[0] ?? markedSyllableToNumbered(group))
    } else {
      throw new Error(`Cannot align "${token}" / "${group}" in: ${chinese}`)
    }
  }

  const hanChars = [...chinese].filter((c) => /[\u4e00-\u9fff]/u.test(c))
  if (hanChars.length !== pyParts.length) {
    const flat = markedToNumberedList(
      markedPinyin.replace(/[“”"':]/g, ' ').replace(/[!.?,，。！？、；：]/g, ' '),
    )
    if (flat.length === hanChars.length) {
      pyParts.length = 0
      pyParts.push(...flat)
    } else {
      throw new Error(
        `Han/py mismatch (${hanChars.length} vs ${pyParts.length}, flat ${flat.length}): ${chinese}`,
      )
    }
  }

  return {
    chinese,
    english,
    pinyin: markedPinyin.replace(/\s+/g, ' ').trim(),
    parts: hanChars.join('|'),
    py: pyParts.join('|'),
  }
}
