function splitFilename(filename) {
  return String(filename)
    .trim()
    .replace(/^\/+/, '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
}

/**
 * Absolute URLs to try for the same file (Vite `base`, then encoding variants).
 * @param {string} filename
 * @returns {string[]}
 */
export function ankiAudioSrcCandidates(filename) {
  const segments = splitFilename(filename)
  if (segments.length === 0) return []

  const encodedPath = segments.map((s) => encodeURIComponent(s)).join('/')
  const rawPath = segments.join('/')

  if (typeof window === 'undefined') {
    const base = import.meta.env.BASE_URL || '/'
    const a = `${base}anki-audio/${encodedPath}`
    const b = rawPath !== encodedPath ? `${base}anki-audio/${rawPath}` : null
    return b ? [a, b] : [a]
  }

  const baseHref = new URL(import.meta.env.BASE_URL || '/', window.location.origin).href
  const encodedHref = new URL(`anki-audio/${encodedPath}`, baseHref).href
  const rawHref = new URL(`anki-audio/${rawPath}`, baseHref).href
  return encodedHref === rawHref ? [encodedHref] : [encodedHref, rawHref]
}

/**
 * @param {string} term
 * @param {string | null | undefined} audioFile from deck (exact phrase file)
 * @param {Record<string, string>} audioMap
 * @returns {{
 *   mode: 'exact' | 'character-fallback' | 'none'
 *   clips: { mp3: string; char?: string }[]
 *   missingChars: string[]
 * }}
 */
export function buildPlaybackPlan(term, audioFile, audioMap) {
  const t = (term || '').trim()
  if (!t) return { mode: 'none', clips: [], missingChars: [] }

  const fromDeck = audioFile && String(audioFile).trim()
  const fromMap = audioMap?.[t]
  const exactFile = fromDeck || fromMap || null

  if (exactFile) {
    return { mode: 'exact', clips: [{ mp3: exactFile }], missingChars: [] }
  }

  const chars = [...t].filter((ch) => /^[\u4e00-\u9fff]$/u.test(ch))
  if (chars.length === 0) {
    return { mode: 'none', clips: [], missingChars: [] }
  }

  const clips = []
  const missingChars = []
  for (const ch of chars) {
    const mp3 = audioMap?.[ch]
    if (mp3) clips.push({ mp3, char: ch })
    else missingChars.push(ch)
  }

  if (clips.length === 0) {
    return { mode: 'none', clips: [], missingChars: chars }
  }
  return { mode: 'character-fallback', clips, missingChars }
}
