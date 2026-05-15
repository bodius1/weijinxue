/**
 * Anki HSK deck metadata + filename map (bundled under mandarin_app_anki_assets).
 * To use `src/data/audioMap.json` instead, copy those JSON files from
 * mandarin_app_anki_assets/src/data/ and point imports here.
 */
import audioMap from '../../mandarin_app_anki_assets/src/data/audioMap.json'
import hskDeckByHanzi from '../../mandarin_app_anki_assets/src/data/hskDeckByHanzi.json'

export { audioMap, hskDeckByHanzi }

/** @param {string} simplified */
export function lookupDeckEntryByHanzi(simplified) {
  if (!simplified) return null
  return hskDeckByHanzi[simplified] ?? null
}
