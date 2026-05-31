/**
 * Strips markdown fences and parses JSON safely.
 * @param {string} rawText
 */
export function parseAIJson(rawText) {
  if (!rawText) throw new Error('Empty response')

  let cleaned = String(rawText).trim()

  cleaned = cleaned.replace(/^```json\s*/i, '')
  cleaned = cleaned.replace(/^```\s*/i, '')
  cleaned = cleaned.replace(/```\s*$/i, '')
  cleaned = cleaned.trim()

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in response')
  }
  cleaned = cleaned.slice(firstBrace, lastBrace + 1)

  try {
    return JSON.parse(cleaned)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`JSON parse failed: ${msg}`)
  }
}

/**
 * @param {unknown} parsed
 */
export function validateStoryBeat(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid story beat')
  const p = /** @type {Record<string, unknown>} */ (parsed)
  const required = ['narration', 'speaker', 'dialogue', 'productionPrompt']
  for (const key of required) {
    if (p[key] == null || p[key] === '') throw new Error(`Missing field: ${key}`)
  }
  const dialogue = /** @type {Record<string, unknown>} */ (p.dialogue)
  if (!dialogue.hanzi) throw new Error('Missing dialogue.hanzi')
  return true
}

/**
 * @param {unknown} parsed
 */
export function validateThreeVoices(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid three voices response')
  const p = /** @type {Record<string, unknown>} */ (parsed)
  const voices = /** @type {Record<string, unknown>} */ (p.voices ?? {})
  const hasTeacher = voices.teacher || voices.laoshi
  const hasFriend = voices.friend || voices.pengyou
  const hasBystander = voices.bystander || voices.luren
  if (!hasTeacher) throw new Error('Missing teacher/laoshi voice')
  if (!hasFriend) throw new Error('Missing friend/pengyou voice')
  if (!hasBystander) throw new Error('Missing bystander/luren voice')
  return true
}
