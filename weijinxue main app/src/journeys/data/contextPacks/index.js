/**
 * Registry of Context Packs for Journeys (Phase 2+).
 * Import packs here when adding new scenarios.
 */
import { timeDateContextPack } from './timeDate.js'

/** @type {import('../../engine/contextPackSchema.js').ContextPack[]} */
export const contextPacks = [timeDateContextPack]

/** @type {Record<string, import('../../engine/contextPackSchema.js').ContextPack>} */
export const contextPacksById = Object.fromEntries(contextPacks.map((p) => [p.id, p]))

/**
 * @param {string} id
 * @returns {import('../../engine/contextPackSchema.js').ContextPack | undefined}
 */
export function getContextPackById(id) {
  return contextPacksById[id]
}

/**
 * @param {string} id
 * @returns {import('../../engine/contextPackSchema.js').ContextPack}
 */
export function requireContextPackById(id) {
  const pack = getContextPackById(id)
  if (!pack) throw new Error(`Unknown context pack: ${id}`)
  return pack
}

export { timeDateContextPack }
