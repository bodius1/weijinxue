const STORY_MODE_KEY = 'yuban_story_generation_mode'

/** @typedef {'llm_always' | 'hybrid' | 'local_first'} StoryGenerationMode */

/**
 * @param {number} [hskLevel]
 * @returns {StoryGenerationMode}
 */
export function getStoryGenerationMode(hskLevel = 1) {
  try {
    const stored = localStorage.getItem(STORY_MODE_KEY)
    if (stored === 'llm_always' || stored === 'hybrid' || stored === 'local_first') {
      return stored
    }
  } catch {
    /* ignore */
  }
  const env = import.meta.env.VITE_YUBAN_STORY_GENERATION_MODE
  if (env === 'llm_always' || env === 'hybrid' || env === 'local_first') return env
  return hskLevel <= 1 ? 'hybrid' : 'llm_always'
}

/**
 * @param {number} turnIndex 0-based turns this session
 * @param {StoryGenerationMode} mode
 */
export function shouldUseLocalStoryBeat(turnIndex, mode) {
  if (mode === 'llm_always') return false
  if (mode === 'local_first') return true
  return turnIndex % 3 !== 2
}
