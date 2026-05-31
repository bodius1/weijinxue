/**
 * @typedef {'warm' | 'cold' | 'mastered'} VocabMastery
 * @typedef {{ pinyin: string, english: string, firstSeen: number, lastSeen: number, encounterCount: number, mastery: VocabMastery }} VocabEntry
 * @typedef {{ vocabulary?: Record<string, VocabEntry>, sessionsCompleted?: number }} StoryStateSlice
 */

/**
 * Add or update a word in the user's vocabulary.
 * @param {StoryStateSlice} state
 * @param {(patch: object) => Promise<void>} updateState
 * @param {{ hanzi: string, pinyin?: string, english?: string }} word
 */
export async function recordVocabEncounter(state, updateState, word) {
  const hanzi = String(word.hanzi ?? '').trim()
  if (!hanzi || !state?.vocabulary) return

  const existing = state.vocabulary[hanzi]
  const now = Date.now()

  const updated = existing
    ? {
        ...existing,
        lastSeen: now,
        encounterCount: existing.encounterCount + 1,
        mastery: /** @type {const} */ ('warm'),
      }
    : {
        pinyin: String(word.pinyin ?? '').trim(),
        english: String(word.english ?? '').trim(),
        firstSeen: now,
        lastSeen: now,
        encounterCount: 1,
        mastery: /** @type {const} */ ('warm'),
      }

  await updateState({
    vocabulary: { ...state.vocabulary, [hanzi]: updated },
  })
}

/**
 * Mark words that haven't been seen in 5+ sessions as cold; high encounter count → mastered.
 * @param {StoryStateSlice} state
 * @returns {Record<string, VocabEntry>}
 */
export function classifyVocabMastery(state) {
  const sessions = Number(state?.sessionsCompleted ?? 0)
  const fiveSessionsAgo = sessions - 5
  const vocabulary = state?.vocabulary ?? {}
  /** @type {Record<string, VocabEntry>} */
  const out = {}

  for (const [hanzi, data] of Object.entries(vocabulary)) {
    if (data.encounterCount >= 5) {
      out[hanzi] = { ...data, mastery: 'mastered' }
    } else if (sessions >= 5 && data.lastSeen < fiveSessionsAgo) {
      out[hanzi] = { ...data, mastery: 'cold' }
    } else {
      out[hanzi] = { ...data, mastery: 'warm' }
    }
  }
  return out
}
