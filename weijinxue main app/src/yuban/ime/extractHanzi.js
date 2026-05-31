const HANZI_RUN = /[\u4e00-\u9fff]+/gu

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractHanziRuns(text) {
  if (!text) return []
  const runs = []
  for (const m of String(text).matchAll(HANZI_RUN)) {
    const s = m[0].trim()
    if (s) runs.push(s)
  }
  return runs
}
