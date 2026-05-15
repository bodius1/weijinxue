const TONE_VOWELS = new Set(
  Array.from('āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'),
)

/** Tone-marked vowel or ü (covers lü, nü, etc.). */
export function hasPinyinToneMarker(token) {
  for (const ch of token) {
    if (TONE_VOWELS.has(ch)) return true
    if (ch === 'ü' || ch === 'Ü') return true
  }
  return false
}

/** Allows comma after syllable (e.g. chéng,). */
const PINYIN_TOKEN_RE = /^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\-',]+$/i

export function parseHsk6Line(line) {
  const trimmed = line.replace(/\s+$/, '')
  if (!trimmed) return null

  const tokens = trimmed.split(/\s+/)
  if (tokens.length < 4) {
    throw new Error(`Expected at least 4 tokens: ${trimmed}`)
  }

  const simplified = tokens[0]

  let i = 2
  while (i < tokens.length && !hasPinyinToneMarker(tokens[i])) {
    i += 1
  }
  if (i >= tokens.length) {
    throw new Error(`No tone-marked pinyin token: ${trimmed}`)
  }

  const pinyinParts = []
  while (i < tokens.length) {
    const t = tokens[i]
    if (!PINYIN_TOKEN_RE.test(t)) break
    if (!hasPinyinToneMarker(t)) break
    pinyinParts.push(t)
    i += 1
  }

  const pinyin = pinyinParts.join(' ')
  const english = tokens.slice(i).join(' ').trim()

  return { simplified, pinyin, english }
}

export function parseHsk6VocabText(raw) {
  const rows = []
  for (const line of raw.split(/\r?\n/)) {
    try {
      const parsed = parseHsk6Line(line)
      if (parsed) rows.push(parsed)
    } catch {
      // skip malformed lines (e.g. stray blank lines)
    }
  }
  return rows
}
