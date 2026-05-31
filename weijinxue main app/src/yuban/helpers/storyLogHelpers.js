/**
 * @param {{ storyLog?: { date?: string, summary: string, scenario?: string }[] }} state
 * @param {(patch: object) => Promise<void>} updateState
 * @param {{ summary: string, scenario?: string }} entry
 */
export async function appendStoryLog(state, updateState, entry) {
  const log = Array.isArray(state?.storyLog) ? state.storyLog : []
  const newEntry = {
    ...entry,
    date: new Date().toISOString(),
  }
  const updated = [newEntry, ...log].slice(0, 10)
  await updateState({ storyLog: updated })
}
