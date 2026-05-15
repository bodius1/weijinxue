/** Sentence rows per HSK level (1–6); 5–6 mirror level 4 until dedicated JSON exists. Filled by {@link preloadSentenceData}.
 * Each row’s `py` field (numbered syllables aligned with `parts`) is the source of truth for Type → Sentences context IME; see `sentenceIme.js`. */
export const SENT_ROWS_BY_LEVEL = [[], [], [], [], [], []]

/** @type {Promise<void> | null} */
let _preloadPromise = null

export function preloadSentenceData() {
  if (_preloadPromise) return _preloadPromise
  _preloadPromise = (async () => {
    const urls = [1, 2, 3, 4].map((n) => new URL(`../data/sentences_hsk${n}.json`, import.meta.url).href)
    const rows = await Promise.all(
      urls.map((u) =>
        fetch(u).then((r) => {
          if (!r.ok) throw new Error(`Failed to load ${u}: ${r.status}`)
          return r.json()
        }),
      ),
    )
    for (let i = 0; i < 4; i += 1) {
      SENT_ROWS_BY_LEVEL[i] = Array.isArray(rows[i]) ? rows[i] : []
    }
    const s4 = SENT_ROWS_BY_LEVEL[3]
    SENT_ROWS_BY_LEVEL[4] = s4
    SENT_ROWS_BY_LEVEL[5] = s4
  })().catch((err) => {
    _preloadPromise = null
    throw err
  })
  return _preloadPromise
}
