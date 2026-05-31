const STORAGE_GROQ = 'yuban_groq_key'
const STORAGE_ANTHROPIC = 'yuban_anthropic_key'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

/**
 * @returns {{ provider: 'anthropic' | 'groq', key: string } | null}
 */
export function readYubanSession() {
  if (typeof localStorage === 'undefined') return null
  try {
    const anthropic = localStorage.getItem(STORAGE_ANTHROPIC)?.trim() ?? ''
    const groq = localStorage.getItem(STORAGE_GROQ)?.trim() ?? ''
    if (anthropic) return { provider: 'anthropic', key: anthropic }
    if (groq) return { provider: 'groq', key: groq }
  } catch {
    /* ignore */
  }
  return null
}

/**
 * @param {{ apiKey: string, system: string, messages: { role: string, content: string }[] }} opts
 */
async function callAnthropic({ apiKey, system, messages }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system,
      messages,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = /** @type {Error & { status: number }} */ (new Error('api_error'))
    err.status = res.status
    throw err
  }

  const block = data?.content?.find((b) => b.type === 'text')
  const text = block?.text ?? ''
  return typeof text === 'string' ? text : ''
}

/**
 * @param {{ apiKey: string, systemPrompt: string, messages: { role: string, content: string }[] }} opts
 */
async function callGroq({ apiKey, systemPrompt, messages }) {
  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ]
  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: openaiMessages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = /** @type {Error & { status: number }} */ (new Error('groq_error'))
    e.status = res.status
    throw e
  }
  const reply = data?.choices?.[0]?.message?.content
  return typeof reply === 'string' ? reply : ''
}

/**
 * Single-turn AI call for story beats and three-voice grading.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
/** @returns {{ provider: string, model: string } | null} */
export function getYubanModelInfo() {
  const session = readYubanSession()
  if (!session) return null
  return {
    provider: session.provider,
    model: session.provider === 'anthropic' ? ANTHROPIC_MODEL : GROQ_MODEL,
  }
}

export async function callYubanAI(systemPrompt, userMessage) {
  const session = readYubanSession()
  if (!session) throw new Error('No API key configured')

  const messages = [{ role: 'user', content: userMessage }]

  if (session.provider === 'anthropic') {
    return callAnthropic({ apiKey: session.key, system: systemPrompt, messages })
  }
  return callGroq({ apiKey: session.key, systemPrompt, messages })
}
