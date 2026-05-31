/**
 * @typedef {{ npcs?: Record<string, object>, sessionsCompleted?: number }} StoryStateSlice
 */

/**
 * @param {StoryStateSlice} state
 * @param {(patch: object) => Promise<void>} updateState
 * @param {{ id: string, chineseName: string, pinyinName: string, role: string, notes?: string }} npc
 */
export async function introduceNPC(state, updateState, npc) {
  const id = String(npc.id ?? '').trim()
  if (!id || !state?.npcs || state.npcs[id]) return

  await updateState({
    npcs: {
      ...state.npcs,
      [id]: {
        chineseName: npc.chineseName,
        pinyinName: npc.pinyinName,
        role: npc.role,
        notes: npc.notes ?? '',
        firstMet: `session ${state.sessionsCompleted ?? 0}`,
        relationship: 'new_acquaintance',
      },
    },
  })
}
