/** Tatoeba sentence search (cmn → eng). */
export function tatoebaSearchUrl(query, page = 1) {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.DEV
      ? '/tatoeba-api'
      : 'https://tatoeba.org'
  const q = encodeURIComponent(query)
  return `${base}/en/api_v0/search?from=cmn&to=eng&query=${q}&page=${page}`
}

export function stripHtml(html) {
  if (!html) return ''
  return String(html).replace(/<[^>]*>/g, '')
}

/**
 * Tatoeba often returns `html` with named entities (&egrave;, &eacute;, …).
 * Strip tags first, then decode so UI shows proper Unicode (e.g. Wèi not W&egrave;i).
 */
export function decodeHtmlEntities(text) {
  if (!text) return ''
  const s = String(text)
  if (typeof document !== 'undefined') {
    try {
      const ta = document.createElement('textarea')
      ta.innerHTML = s
      return ta.value
    } catch {
      /* ignore */
    }
  }
  return s
    .replace(/&#x([\da-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
}

export function tatoebaPlainText(maybeHtml) {
  return decodeHtmlEntities(stripHtml(maybeHtml)).trim()
}

export function getSimplifiedSentence(sentence) {
  const tr = sentence.transcriptions?.find(
    (t) => t.script === 'Hans' && t.type === 'altscript',
  )
  if (tr?.text) return tr.text
  if (sentence.script === 'Hans' && sentence.text) return sentence.text
  return sentence.text || ''
}

export function getPinyinFromSentence(sentence) {
  const tr = sentence.transcriptions?.find(
    (t) => t.script === 'Latn' && t.type === 'transcription',
  )
  const raw = tr?.html ?? tr?.text ?? ''
  return tatoebaPlainText(raw)
}

export function getFirstEnglish(sentence) {
  const groups = sentence.translations || []
  for (const g of groups) {
    if (!Array.isArray(g)) continue
    for (const t of g) {
      if (t?.lang === 'eng' && t.text) return String(t.text).trim()
    }
  }
  return ''
}
