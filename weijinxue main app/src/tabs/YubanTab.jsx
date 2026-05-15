import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildPinyinPrefixIndex,
  digitKeyToSlot,
  getCedictOrNull,
  HSK_DATA,
  lookupFromIndex,
  normalizeQuery,
} from '../utils/pinyinIme.js'
import { saveLearnedCharacter } from '../utils/learnedCharacters.js'
import { formatEnglishMeaningForDisplay } from '../utils/formatEnglishMeaning.js'
import { pinyinForDisplay } from '../utils/pinyinToneMark.js'

const STORAGE_GROQ = 'yuban_groq_key'
const STORAGE_ANTHROPIC = 'yuban_anthropic_key'
/** @deprecated migrated once into STORAGE_ANTHROPIC */
const LEGACY_ANTHROPIC_STORAGE = 'anthropic_api_key'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

const SCENARIOS = [
  { id: 'cafe', label: '☕ At a café' },
  { id: 'station', label: '🚇 At the train station' },
  { id: 'shopping', label: '🛒 Shopping' },
  { id: 'meet', label: '👋 Meeting someone new' },
  { id: 'doctor', label: '🏥 At the doctor' },
  { id: 'school', label: '🏫 At school' },
  { id: 'food', label: '🍜 Ordering food' },
  { id: 'hotel', label: '🏨 At a hotel' },
]

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function buildSystemPrompt(scenarioLabel, hskLevel, injectedWords) {
  return `You are Yǔbàn (语伴), a friendly AI language companion for Mandarin learners. Your name means 'language buddy' in Chinese. You are like a chill bilingual friend who helps people practice Mandarin naturally.

Current scenario: ${scenarioLabel}
User's HSK level: HSK ${hskLevel}

You are talking to a user studying HSK ${hskLevel}. Try to naturally incorporate HSK ${hskLevel} vocabulary words in your responses.
Here are some key HSK ${hskLevel} words to use:
${injectedWords}
Use these words naturally in conversation so the user practices them in context.

Rules:
- ALWAYS respond primarily in Chinese (Mandarin)
- Keep your vocabulary at or below the user's HSK level
- After your Chinese response, add an English translation in parentheses on a new line
- If the user makes a grammar or vocabulary mistake, gently correct them in a friendly way like a real friend would: "哈哈 oh did you mean...?" never be harsh
- If the user writes something unclear, ask for clarification naturally
- Keep responses SHORT — 1-3 sentences max
- Use natural casual Chinese, not textbook formal Chinese
- Occasionally add relevant emoji to feel friendly
- Start the conversation naturally based on the scenario
- If the user writes in English, gently encourage them to try in Chinese: "来，用中文试试！"
- When you correct something, highlight the correct version clearly (you may add a short line starting with 💡 with the correction)
- Tips: About 1 out of 3 responses (not every time), whenever you use a word that is likely new for the user's HSK level, add a tip at the end of your message in this exact JSON format on a new line:
TIP: {"chinese":"一杯","english":"one cup (measure word for drinks)","example":"一杯咖啡"}
- Never break character — stay in the scenario`
}

/**
 * Extract one TIP json line if present.
 * @param {string} raw
 * @returns {{ clean: string, tip: null | { chinese?: string, english?: string, example?: string } }}
 */
function extractTipJson(raw) {
  const lines = String(raw ?? '').split('\n')
  /** @type {null | { chinese?: string, english?: string, example?: string }} */
  let tip = null
  const kept = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('TIP:')) {
      const jsonPart = trimmed.slice(4).trim()
      if (jsonPart) {
        try {
          const obj = JSON.parse(jsonPart)
          if (obj && typeof obj === 'object') tip = obj
        } catch {
          // ignore malformed JSON
        }
      }
      continue
    }
    kept.push(line)
  }
  return { clean: kept.join('\n').trim(), tip }
}

/** @param {string} raw */
function parseAssistantContent(raw) {
  let tip = ''
  let body = raw.trim()
  const tipIdx = body.search(/\n(?:💡|【提示】|小提示)/)
  if (tipIdx >= 0) {
    tip = body.slice(tipIdx).replace(/^\n/, '').trim()
    body = body.slice(0, tipIdx).trim()
  }

  let chinese = body
  let english = ''
  const openParen = body.lastIndexOf('\n(')
  if (openParen >= 0) {
    chinese = body.slice(0, openParen).trim()
    const rest = body.slice(openParen + 2)
    const close = rest.lastIndexOf(')')
    english = close >= 0 ? rest.slice(0, close).trim() : rest.trim()
  }

  return { chinese, english, tip }
}

/** @param {string} text */
function extractHanRuns(text) {
  const re = /[\u4e00-\u9fff]+/g
  const set = new Set()
  let m
  while ((m = re.exec(text))) set.add(m[0])
  return [...set]
}

/**
 * Greedy longest-match scan using an HSK word set + maxLen.
 * @param {string} text
 * @param {Set<string>} wordSet
 * @param {number} maxLen
 * @returns {{ word: string, start: number, end: number }[]}
 */
function findHskMatches(text, wordSet, maxLen) {
  const s = String(text ?? '')
  /** @type {{ word: string, start: number, end: number }[]} */
  const out = []
  let i = 0
  while (i < s.length) {
    let hit = ''
    const maxHere = Math.min(maxLen, s.length - i)
    for (let len = maxHere; len >= 1; len -= 1) {
      const sub = s.slice(i, i + len)
      if (wordSet.has(sub)) {
        hit = sub
        break
      }
    }
    if (hit) {
      out.push({ word: hit, start: i, end: i + hit.length })
      i += hit.length
    } else {
      i += 1
    }
  }
  return out
}

/**
 * Render Chinese text with HSK highlighting and hover tooltip.
 * @param {{ text: string, wordSet: Set<string>, maxLen: number, meta: Map<string, { pinyin: string, english: string } | undefined> }} props
 */
function HighlightedChinese({ text, wordSet, maxLen, meta }) {
  const matches = useMemo(() => findHskMatches(text, wordSet, maxLen), [text, wordSet, maxLen])
  if (!matches.length) return <>{text}</>

  const nodes = []
  let last = 0
  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i]
    if (m.start > last) nodes.push(<span key={`t-${i}-${last}`}>{text.slice(last, m.start)}</span>)
    const info = meta.get(m.word)
    nodes.push(
      <span
        key={`w-${i}-${m.start}`}
        className="relative inline-block border-b border-[#D4A843] text-[#D4A843] [border-bottom-width:1px]"
      >
        <span className="group relative inline-block">
          <span className="text-inherit">{m.word}</span>
          {info ? (
            <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-[min(18rem,80vw)] -translate-x-1/2 rounded-lg border border-taupe bg-[#0f0e0c] px-3 py-2 text-xs text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              <span className="font-semibold text-[#D4A843]">{pinyinForDisplay(info.pinyin)}</span>
              <span className="text-muted"> — </span>
              <span className="text-espresso">{formatEnglishMeaningForDisplay(m.word, info.english)}</span>
            </span>
          ) : null}
        </span>
      </span>,
    )
    last = m.end
  }
  if (last < text.length) nodes.push(<span key="tail">{text.slice(last)}</span>)
  return <>{nodes}</>
}

/** @param {string} simplified */
function firstCedictRow(simplified) {
  const dict = getCedictOrNull()
  if (!dict) return null
  const all = dict.data.all
  for (let i = 0; i < all.length; i++) {
    const raw = all[i]
    if (raw[1] === simplified) return raw
  }
  return null
}

/** @param {string} simplified */
function lookupWordMeta(simplified) {
  const raw = firstCedictRow(simplified)
  if (!raw) return null
  const dict = getCedictOrNull()
  if (!dict) return null
  const e = dict.expandValue(raw, false)
  const pinField = typeof e.pinyin === 'string' ? e.pinyin : ''
  const firstPin = pinField.trim().split(/\s+/)[0] ?? ''
  return {
    simplified: e.simplified,
    pinyin: firstPin || pinField,
    meaning: e.english.join(' / '),
  }
}

/** @param {string} tip */
function extractCorrectionPairsFromTip(tip) {
  /** @type {{ simplified: string, meaning: string }[]} */
  const out = []
  for (const line of tip.split('\n')) {
    const trimmed = line.trim()
    const eq = trimmed.match(/([\u4e00-\u9fff]+(?:\s+[\u4e00-\u9fff]+)*)\s*[=＝]\s*(.+)/)
    if (eq) {
      const simp = eq[1].replace(/\s+/g, '')
      out.push({ simplified: simp, meaning: eq[2].trim() })
    }
  }
  return out
}

function TipBody({ text }) {
  const segments = []
  const re = /([\u4e00-\u9fff]+)/g
  let m
  let last = 0
  while ((m = re.exec(text))) {
    if (m.index > last) {
      segments.push({ type: 'text', s: text.slice(last, m.index) })
    }
    segments.push({ type: 'han', s: m[1] })
    last = m.index + m[1].length
  }
  if (last < text.length) segments.push({ type: 'text', s: text.slice(last) })

  return (
    <p className="text-sm leading-relaxed text-espresso">
      {segments.map((seg, idx) =>
        seg.type === 'han' ? (
          <span key={idx} className="font-medium text-[#D4A843]">
            {seg.s}
          </span>
        ) : (
          <span key={idx}>{seg.s}</span>
        ),
      )}
    </p>
  )
}

function YubanAvatar() {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D4A843]/60 bg-[#D4A843]/20 text-lg font-semibold leading-none text-[#D4A843]"
      aria-hidden
    >
      伴
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <YubanAvatar />
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-taupe bg-elevated px-4 py-3">
        <p className="text-sm text-espresso">
          Yǔbàn is typing
          <span className="inline-flex pl-0.5">
            {[0, 200, 400].map((delay) => (
              <span
                key={delay}
                className="animate-pulse font-bold text-[#D4A843]"
                style={{ animationDelay: `${delay}ms`, animationDuration: '1.2s' }}
              >
                .
              </span>
            ))}
          </span>
        </p>
      </div>
    </div>
  )
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
      max_tokens: 1024,
      system,
      messages,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = /** @type {Error & { status: number }} */ (new Error('api_error'))
    err.status = res.status
    err.body = data
    throw err
  }

  const block = data?.content?.find((b) => b.type === 'text')
  const text = block?.text ?? ''
  return typeof text === 'string' ? text : ''
}

function readYubanSession() {
  if (typeof localStorage === 'undefined') return null
  try {
    const anthropic = localStorage.getItem(STORAGE_ANTHROPIC)?.trim() ?? ''
    const groq = localStorage.getItem(STORAGE_GROQ)?.trim() ?? ''
    if (anthropic) return { provider: /** @type {const} */ ('anthropic'), key: anthropic }
    if (groq) return { provider: /** @type {const} */ ('groq'), key: groq }
  } catch {
    /* ignore */
  }
  return null
}

function migrateLegacyAnthropicKey() {
  if (typeof localStorage === 'undefined') return
  try {
    const legacy = localStorage.getItem(LEGACY_ANTHROPIC_STORAGE)?.trim() ?? ''
    const next = localStorage.getItem(STORAGE_ANTHROPIC)?.trim() ?? ''
    if (legacy && !next) {
      localStorage.setItem(STORAGE_ANTHROPIC, legacy)
    }
  } catch {
    /* ignore */
  }
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
      max_tokens: 300,
      temperature: 0.8,
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

export default function YubanTab() {
  const [hasGroqKey, setHasGroqKey] = useState(false)
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false)
  const [groqKeyInput, setGroqKeyInput] = useState('')
  const [anthropicKeyInput, setAnthropicKeyInput] = useState('')
  const [keyOverlay, setKeyOverlay] = useState(false)

  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const [hskLevel, setHskLevel] = useState(3)

  /** @type {[{ id: string, role: 'user'|'assistant', content: string, hidden?: boolean, parsed?: ReturnType<typeof parseAssistantContent> }]} */
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [errorBanner, setErrorBanner] = useState('')

  const [composedHanzi, setComposedHanzi] = useState('')
  const [imeInput, setImeInput] = useState('')
  const [candidatesExpanded, setCandidatesExpanded] = useState(false)
  const [indexReady, setIndexReady] = useState(false)

  const [vocabOpen, setVocabOpen] = useState(false)

  const [pinyinIndex, setPinyinIndex] = useState(/** @type {ReturnType<typeof buildPinyinPrefixIndex> | null} */ (null))
  const candidatesRef = useRef(/** @type {{ simplified: string, pinyin: string, english: string[] }[]} */ ([]))
  const candidatesExpandedRef = useRef(false)
  const messageListRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const scrollAnchorRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]

  const hasSession = hasAnthropicKey || hasGroqKey
  const isPremiumActive = hasAnthropicKey
  const hskList = useMemo(() => HSK_DATA[hskLevel - 1] ?? [], [hskLevel])
  const injectedHskWords = useMemo(
    () =>
      (hskList ?? [])
        .slice(0, 30)
        .map((x) => String(x?.simplified ?? '').trim())
        .filter(Boolean)
        .join('、'),
    [hskList],
  )
  const hskMeta = useMemo(() => {
    /** @type {Map<string, { pinyin: string, english: string }>} */
    const m = new Map()
    for (const row of hskList ?? []) {
      const simp = String(row?.simplified ?? '').trim()
      if (!simp) continue
      m.set(simp, { pinyin: String(row?.pinyin ?? '').trim(), english: String(row?.english ?? '').trim() })
    }
    return m
  }, [hskList])
  const hskWordSet = useMemo(() => new Set([...hskMeta.keys()]), [hskMeta])
  const hskMaxLen = useMemo(() => {
    let max = 1
    for (const w of hskMeta.keys()) max = Math.max(max, w.length)
    return max
  }, [hskMeta])

  const syncKeyFlags = useCallback(() => {
    if (typeof localStorage === 'undefined') return
    try {
      setHasGroqKey(Boolean(localStorage.getItem(STORAGE_GROQ)?.trim()))
      setHasAnthropicKey(Boolean(localStorage.getItem(STORAGE_ANTHROPIC)?.trim()))
    } catch {
      setHasGroqKey(false)
      setHasAnthropicKey(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      const idx = buildPinyinPrefixIndex()
      queueMicrotask(() => {
        setPinyinIndex(idx)
        setIndexReady(true)
      })
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  const queryNorm = useMemo(() => normalizeQuery(imeInput), [imeInput])

  const candidates = useMemo(() => {
    if (!indexReady || !pinyinIndex) return []
    return lookupFromIndex(pinyinIndex, queryNorm, undefined, undefined)
  }, [queryNorm, indexReady, pinyinIndex])

  useEffect(() => {
    candidatesRef.current = candidates
  }, [candidates])

  useEffect(() => {
    candidatesExpandedRef.current = candidatesExpanded
  }, [candidatesExpanded])

  const visibleLimit = candidatesExpanded ? Math.min(9, candidates.length) : Math.min(4, candidates.length)
  const visibleCandidates = candidates.slice(0, visibleLimit)
  const canExpandCandidates = candidates.length > 4

  const systemPrompt = useMemo(
    () => buildSystemPrompt(scenario.label, hskLevel, injectedHskWords),
    [scenario.label, hskLevel, injectedHskWords],
  )

  const scrollToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  const pushAssistant = useCallback((content) => {
    const { clean, tip } = extractTipJson(content)
    const parsed = parseAssistantContent(clean)
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'assistant', content: clean, parsed: { ...parsed, tipJson: tip } },
    ])
  }, [])

  const runAssistantTurn = useCallback(
    async (nextMessages) => {
      setErrorBanner('')
      setLoading(true)
      const session = readYubanSession()
      if (!session) {
        setLoading(false)
        return
      }
      const apiMessages = nextMessages.map((m) => ({ role: m.role, content: m.content }))
      try {
        let text = ''
        if (session.provider === 'anthropic') {
          text = await callAnthropic({
            apiKey: session.key,
            system: systemPrompt,
            messages: apiMessages,
          })
        } else {
          text = await callGroq({
            apiKey: session.key,
            systemPrompt,
            messages: apiMessages,
          })
        }
        pushAssistant(text)
      } catch (e) {
        const status =
          typeof e === 'object' && e !== null && 'status' in e ? Number(/** @type {{ status?: number }} */ (e).status) : NaN
        if (session.provider === 'groq') {
          if (status === 401) {
            setErrorBanner('Invalid Groq API key. Get a free one at console.groq.com')
          } else if (status === 429) {
            setErrorBanner('Rate limit hit — wait a moment and try again')
          } else {
            setErrorBanner('Connection error, please try again')
          }
        } else {
          if (status === 401) {
            setErrorBanner('API key invalid. Please check your key and try again.')
          } else if (status === 429) {
            setErrorBanner('Too many messages! Wait a moment.')
          } else {
            setErrorBanner('Connection failed. Check your internet and try again.')
          }
        }
      } finally {
        setLoading(false)
      }
    },
    [pushAssistant, systemPrompt],
  )

  const beginScenario = useCallback(async () => {
    const bootstrapUser = {
      id: uid(),
      role: /** @type {const} */ ('user'),
      content:
        '（请作为我的中文语伴，根据当前情景先说第一句开场白——只用中文，简短自然。）',
      hidden: true,
    }
    const next = [bootstrapUser]
    setMessages([bootstrapUser])
    await runAssistantTurn(next)
  }, [runAssistantTurn])

  const beginScenarioRef = useRef(beginScenario)
  useEffect(() => {
    beginScenarioRef.current = beginScenario
  }, [beginScenario])

  // Sync keys on mount and optionally bootstrap chat. `syncKeyFlags` is useCallback([]) so this still runs once.
  useEffect(() => {
    migrateLegacyAnthropicKey()
    queueMicrotask(() => syncKeyFlags())
    if (readYubanSession()) {
      queueMicrotask(() => beginScenarioRef.current())
    }
  }, [syncKeyFlags])

  const handleSaveGroq = () => {
    const trimmed = groqKeyInput.trim()
    if (!trimmed) return
    try {
      localStorage.setItem(STORAGE_GROQ, trimmed)
    } catch {
      /* ignore */
    }
    setGroqKeyInput('')
    setKeyOverlay(false)
    syncKeyFlags()
    setMessages([])
    window.setTimeout(() => beginScenario(), 0)
  }

  const handleSaveAnthropic = () => {
    const trimmed = anthropicKeyInput.trim()
    if (!trimmed) return
    try {
      localStorage.setItem(STORAGE_ANTHROPIC, trimmed)
    } catch {
      /* ignore */
    }
    setAnthropicKeyInput('')
    setKeyOverlay(false)
    syncKeyFlags()
    setMessages([])
    window.setTimeout(() => beginScenario(), 0)
  }

  const handleRemovePremium = () => {
    try {
      localStorage.removeItem(STORAGE_ANTHROPIC)
    } catch {
      /* ignore */
    }
    syncKeyFlags()
    setAnthropicKeyInput('')
    setMessages([])
    if (readYubanSession()) {
      window.setTimeout(() => beginScenario(), 0)
    }
  }

  const trySelectSlot = useCallback((slotOnPage) => {
    const list = candidatesRef.current
    const maxSlot = candidatesExpandedRef.current
      ? Math.min(8, list.length - 1)
      : Math.min(3, list.length - 1)
    if (slotOnPage < 0 || slotOnPage > maxSlot) return
    const entry = list[slotOnPage]
    if (!entry) return
    setComposedHanzi((s) => s + entry.simplified)
    setImeInput('')
    setCandidatesExpanded(false)
  }, [])

  const sendUserMessage = useCallback(async () => {
    const text = composedHanzi.trim()
    if (!text || loading) return
    if (imeInput.trim()) {
      setErrorBanner('请先选好候选字再发送（按数字键或空格）。')
      window.setTimeout(() => setErrorBanner(''), 3200)
      return
    }

    const userMsg = { id: uid(), role: /** @type {const} */ ('user'), content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setComposedHanzi('')
    setImeInput('')
    setCandidatesExpanded(false)
    await runAssistantTurn(next)
  }, [composedHanzi, imeInput, loading, messages, runAssistantTurn])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!hasSession || keyOverlay || vocabOpen) return

      const { key, code } = e
      const target = /** @type {HTMLElement | null} */ (e.target)
      if (target && (target.closest('[data-yuban-skip-ime]') || target.closest('input, textarea, select'))) {
        return
      }

      if (key === 'Enter') {
        e.preventDefault()
        sendUserMessage()
        return
      }

      if (key === 'Backspace') {
        e.preventDefault()
        setImeInput((s) => {
          if (s.length > 0) return s.slice(0, -1)
          setComposedHanzi((h) => {
            if (!h.length) return h
            const arr = [...h]
            arr.pop()
            return arr.join('')
          })
          return s
        })
        return
      }

      if (key === 'Escape') {
        e.preventDefault()
        setImeInput('')
        setCandidatesExpanded(false)
        return
      }

      if (key === ' ') {
        if (candidatesRef.current.length > 0) {
          e.preventDefault()
          trySelectSlot(0)
        }
        return
      }

      const slot = digitKeyToSlot(key, code)
      if (slot >= 0 && slot <= 8) {
        if (slot >= 4 && !candidatesExpandedRef.current) {
          e.preventDefault()
          return
        }
        e.preventDefault()
        trySelectSlot(slot)
        return
      }

      if (key.length === 1 && /^[a-z]$/i.test(key)) {
        e.preventDefault()
        setImeInput((s) => s + key.toLowerCase())
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasSession, keyOverlay, sendUserMessage, trySelectSlot, vocabOpen])

  const hskUsedCounts = useMemo(() => {
    /** @type {Map<string, number>} */
    const counts = new Map()
    for (const m of messages) {
      if (m.hidden) continue
      const runs = extractHanRuns(m.content)
      for (const run of runs) {
        const ms = findHskMatches(run, hskWordSet, hskMaxLen)
        for (const hit of ms) {
          counts.set(hit.word, (counts.get(hit.word) ?? 0) + 1)
        }
      }
      if (m.role === 'assistant') {
        const tipLine = /** @type {any} */ (m.parsed)?.tipJson
        const tipChinese = typeof tipLine?.chinese === 'string' ? tipLine.chinese.trim() : ''
        if (tipChinese && hskWordSet.has(tipChinese)) {
          counts.set(tipChinese, (counts.get(tipChinese) ?? 0) + 1)
        }
      }
    }
    return counts
  }, [messages, hskMaxLen, hskWordSet])

  const hskUsedSorted = useMemo(() => {
    const arr = [...hskUsedCounts.entries()].map(([word, count]) => ({ word, count }))
    arr.sort((a, b) => (b.count - a.count) || a.word.localeCompare(b.word, 'zh'))
    return arr
  }, [hskUsedCounts])

  const totalHskWords = hskMeta.size

  const handleSaveCorrections = () => {
    let n = 0
    for (const m of messages) {
      if (m.role !== 'assistant' || !m.parsed?.tip) continue
      const pairs = extractCorrectionPairsFromTip(m.parsed.tip)
      const hanRuns = extractHanRuns(m.parsed.tip)
      const toSave = new Map()
      for (const p of pairs) {
        const meta = lookupWordMeta(p.simplified)
        toSave.set(p.simplified, {
          simplified: p.simplified,
          pinyin: meta?.pinyin ?? '',
          meaning: p.meaning || meta?.meaning || '',
          hskLevel,
        })
      }
      for (const run of hanRuns) {
        if (run.length > 4) continue
        if (!toSave.has(run)) {
          const meta = lookupWordMeta(run)
          if (meta) {
            toSave.set(run, { ...meta, hskLevel })
          }
        }
      }
      for (const entry of toSave.values()) {
        saveLearnedCharacter(entry)
        n += 1
      }
    }
    if (n === 0) {
      setErrorBanner('No corrections found in tips yet.')
      window.setTimeout(() => setErrorBanner(''), 2800)
    }
  }

  const displayMessages = messages.filter((m) => !m.hidden)

  const setupScreen = !hasSession

  if (setupScreen || keyOverlay) {
    return (
      <div className="flex min-h-[calc(100dvh-9rem)] flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-taupe bg-[#1C1A16] p-6 shadow-lg">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {keyOverlay ? 'API keys — Yǔbàn AI' : 'Meet Yǔbàn AI'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-espresso">
              {keyOverlay
                ? 'Update your Groq or Anthropic key. If both are saved, Claude (premium) is used.'
                : 'A chill AI friend to practice Mandarin with.'}
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-taupe bg-elevated/40 p-4">
            <p className="text-sm font-medium text-ink">🆓 Free — Powered by Llama 3.3</p>
            <p className="text-xs text-espresso">Get a free key at console.groq.com</p>
            <input
              type="password"
              value={groqKeyInput}
              onChange={(e) => setGroqKeyInput(e.target.value)}
              className="w-full rounded-xl border border-taupe bg-paper px-4 py-3 text-sm text-ink outline-none ring-[#D4A843]/25 focus:ring-2"
              placeholder="Groq API key"
              autoComplete="off"
              data-yuban-skip-ime
            />
            <button
              type="button"
              onClick={handleSaveGroq}
              className="w-full rounded-xl bg-[#D4A843] px-4 py-3 text-sm font-semibold text-[#0f0e0c] transition hover:bg-[#b8872a]"
            >
              Free
            </button>
          </div>

          <div className="space-y-3 rounded-xl border border-taupe border-t-2 border-t-[#3A3529] bg-elevated/40 p-4 pt-5">
            <p className="text-sm font-medium text-ink">⭐ Premium — Powered by Claude</p>
            <p className="text-xs text-espresso">Better Chinese understanding</p>
            <input
              type="password"
              value={anthropicKeyInput}
              onChange={(e) => setAnthropicKeyInput(e.target.value)}
              className="w-full rounded-xl border border-taupe bg-paper px-4 py-3 text-sm text-ink outline-none ring-[#D4A843]/25 focus:ring-2"
              placeholder="Anthropic API key"
              autoComplete="off"
              data-yuban-skip-ime
            />
            <button
              type="button"
              onClick={handleSaveAnthropic}
              className="w-full rounded-xl border border-[#D4A843]/60 bg-elevated px-4 py-3 text-sm font-semibold text-ink transition hover:border-[#D4A843]"
            >
              Premium
            </button>
            {hasAnthropicKey ? (
              <button
                type="button"
                onClick={handleRemovePremium}
                className="w-full text-center text-xs text-muted underline-offset-2 hover:text-espresso hover:underline"
              >
                Stop using Claude (use Groq only)
              </button>
            ) : null}
          </div>

          <p className="text-xs leading-relaxed text-muted">
            Keys stay in your browser. Groq and Anthropic receive them only when you send a message to their APIs.
          </p>

          {keyOverlay ? (
            <button
              type="button"
              onClick={() => {
                setKeyOverlay(false)
                setGroqKeyInput('')
                setAnthropicKeyInput('')
              }}
              className="text-sm text-espresso underline-offset-2 hover:text-ink hover:underline"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-1 flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Yǔbàn AI</h2>
          <p className="mt-1 text-sm text-espresso">Your Mandarin conversation companion</p>
        </div>
        <div
          className="self-center rounded-full border border-taupe bg-elevated px-3 py-1.5 text-xs font-medium text-ink sm:self-start"
          title={isPremiumActive ? 'Using Anthropic Claude' : 'Using Groq Llama 3.3'}
        >
          {isPremiumActive ? '⭐ Claude' : '🆓 Llama 3.3'}
        </div>
      </header>

      {/* Top bar */}
      <div className="grid gap-3 rounded-xl border border-taupe bg-[#1C1A16] p-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Scenario</span>
          <select
            data-yuban-skip-ime
            value={scenarioId}
            onChange={(e) => {
              setScenarioId(e.target.value)
              setMessages([])
              window.setTimeout(() => beginScenario(), 0)
            }}
            className="rounded-lg border border-taupe bg-elevated px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-[#D4A843]/40"
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Your level</span>
          <select
            data-yuban-skip-ime
            value={hskLevel}
            onChange={(e) => setHskLevel(Number(e.target.value))}
            className="rounded-lg border border-taupe bg-elevated px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-[#D4A843]/40"
          >
            {[1, 2, 3, 4, 5, 6].map((lv) => (
              <option key={lv} value={lv}>
                HSK {lv}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end justify-start sm:justify-end">
          <button
            type="button"
            onClick={() => {
              setKeyOverlay(true)
              setGroqKeyInput('')
              setAnthropicKeyInput('')
            }}
            className="text-xs text-muted underline-offset-2 hover:text-espresso hover:underline"
          >
            Change API keys
          </button>
        </div>
      </div>

      {errorBanner ? (
        <div className="rounded-lg border border-wrong/50 bg-wrong/10 px-4 py-2 text-sm text-ink">{errorBanner}</div>
      ) : null}

      {/* Messages */}
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-taupe bg-[#1C1A16] shadow-inner">
        <div className="min-h-[220px] flex-1 overflow-y-auto px-3 py-4 sm:px-4">
          <div ref={messageListRef} className="mx-auto flex max-w-xl flex-col gap-4">
            {displayMessages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end gap-3">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm border-2 border-[#D4A843]/70 bg-elevated px-4 py-3">
                    <p className="text-xl leading-snug text-ink">
                      <HighlightedChinese text={m.content} wordSet={hskWordSet} maxLen={hskMaxLen} meta={hskMeta} />
                    </p>
                  </div>
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D4A843]/40 bg-elevated text-lg"
                    aria-hidden
                  >
                    👤
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <YubanAvatar />
                  <div className="max-w-[85%] space-y-2">
                    <div className="rounded-2xl rounded-tl-sm border border-taupe bg-elevated px-4 py-3">
                      <p className="text-xl leading-relaxed text-ink">
                        <HighlightedChinese
                          text={m.parsed?.chinese ?? parseAssistantContent(m.content).chinese}
                          wordSet={hskWordSet}
                          maxLen={hskMaxLen}
                          meta={hskMeta}
                        />
                      </p>
                      {(m.parsed?.english ?? parseAssistantContent(m.content).english) ? (
                        <p className="mt-2 text-sm text-muted">
                          {m.parsed?.english ?? parseAssistantContent(m.content).english}
                        </p>
                      ) : null}
                    </div>
                    {(m.parsed?.tip ?? '').trim() ? (
                      <div className="rounded-xl border border-taupe border-l-4 border-l-[#D4A843] bg-[#0f0e0c] px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#D4A843]">
                          💡 小提示 tip
                        </p>
                        <div className="mt-2">
                          <TipBody text={m.parsed?.tip ?? ''} />
                        </div>
                      </div>
                    ) : null}
                    {/** TIP: JSON tip (systematic) */}
                    {/** @type {any} */ (m.parsed)?.tipJson ? (
                      <div className="rounded-xl border border-taupe border-l-4 border-l-[#D4A843] bg-[#0f0e0c] px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#D4A843]">
                          💡 小提示 tip
                        </p>
                        <div className="mt-2 text-sm leading-relaxed text-espresso">
                          <p>
                            <span className="font-medium text-ink">
                              {String(/** @type {any} */ (m.parsed)?.tipJson?.chinese ?? '').trim()}
                            </span>
                            <span className="text-muted"> = </span>
                            <span className="text-espresso">
                              {String(/** @type {any} */ (m.parsed)?.tipJson?.english ?? '').trim()}
                            </span>
                          </p>
                          {String(/** @type {any} */ (m.parsed)?.tipJson?.example ?? '').trim() ? (
                            <p className="mt-1">
                              <span className="text-muted">example:</span>{' '}
                              <span className="font-medium text-ink">
                                {String(/** @type {any} */ (m.parsed)?.tipJson?.example ?? '').trim()}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ),
            )}
            {loading ? <TypingIndicator /> : null}
            <div ref={scrollAnchorRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-[#3A3529] bg-[#252219] px-3 py-4 sm:px-4">
          <div className="mx-auto max-w-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <div
                  tabIndex={-1}
                  className="rounded-xl border border-taupe bg-paper px-4 py-3 font-mono text-lg leading-relaxed text-ink outline-none ring-[#D4A843]/25 focus-visible:ring-2"
                >
                  <span>{composedHanzi}</span>
                  <span className="text-muted">[</span>
                  <span className="text-ink">{imeInput}</span>
                  <span className="animate-pulse text-[#D4A843]">|</span>
                  <span className="text-muted">]</span>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  Type pinyin (IME), then 1–4 / Space — same as Type tab. Enter to send.
                </p>

                <div className="mt-3 overflow-hidden rounded-lg border border-taupe bg-[#1C1A16]">
                  <div className="flex items-center justify-between gap-2 border-b border-taupe/40 px-2 py-2 sm:px-3">
                    <div className="flex w-9 shrink-0 justify-start sm:w-10">
                      {candidatesExpanded ? (
                        <button
                          type="button"
                          onClick={() => setCandidatesExpanded(false)}
                          className="rounded-full border border-taupe/80 px-2 py-0.5 text-xs text-[#D4A843] hover:border-[#D4A843]"
                          aria-label="Show fewer candidates"
                        >
                          «
                        </button>
                      ) : (
                        <span className="inline-block w-9 sm:w-10" aria-hidden />
                      )}
                    </div>
                    <span className="min-w-0 flex-1 text-center text-xs text-muted">
                      {!indexReady
                        ? 'Building dictionary index…'
                        : !candidates.length
                          ? queryNorm
                            ? 'No matches'
                            : 'Type letters for candidates'
                          : candidatesExpanded
                            ? '1–9 or Space for #1'
                            : '1–4 or Space for #1'}
                    </span>
                    <div className="flex w-9 shrink-0 justify-end sm:w-10">
                      {!candidatesExpanded && canExpandCandidates ? (
                        <button
                          type="button"
                          onClick={() => setCandidatesExpanded(true)}
                          className="rounded-full border border-taupe/80 px-2 py-0.5 text-xs text-[#D4A843] hover:border-[#D4A843]"
                          aria-label="Show more candidates"
                        >
                          »
                        </button>
                      ) : (
                        <span className="inline-block w-9 sm:w-10" aria-hidden />
                      )}
                    </div>
                  </div>
                  <div className="overflow-hidden px-2 py-3 sm:px-3">
                    {!indexReady ? (
                      <p className="py-3 text-center text-sm text-muted">Preparing fast lookup…</p>
                    ) : visibleCandidates.length === 0 ? (
                      <p className="py-3 text-center text-sm text-muted">
                        {queryNorm ? 'No candidates — keep typing' : 'Type letters to see candidates'}
                      </p>
                    ) : (
                      <div
                        className={
                          candidatesExpanded
                            ? 'grid grid-cols-3 gap-2 sm:gap-3'
                            : 'flex flex-nowrap justify-center gap-2 overflow-hidden sm:gap-3'
                        }
                      >
                        {visibleCandidates.map((entry, i) => {
                          const num = i + 1
                          const isHi = i === 0
                          return (
                            <button
                              key={`${entry.simplified}-${entry.pinyin}-${num}`}
                              type="button"
                              onClick={() => trySelectSlot(i)}
                              className={[
                                'flex min-w-0 items-baseline justify-center gap-1.5 rounded-full border px-2 py-2.5 text-left transition sm:gap-2 sm:px-4 sm:py-3',
                                candidatesExpanded
                                  ? 'w-full max-w-none'
                                  : 'max-w-[8.5rem] flex-1 basis-0 sm:max-w-[9.5rem]',
                                isHi ? 'border-[#D4A843] ring-2 ring-[#D4A843]/40' : 'border-taupe/80',
                                'bg-elevated hover:border-[#D4A843]',
                              ].join(' ')}
                            >
                              <span className="shrink-0 text-sm font-bold tabular-nums text-[#D4A843] sm:text-base">
                                {num}.
                              </span>
                              <span className="min-w-0 truncate text-lg text-ink sm:text-xl">{entry.simplified}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => sendUserMessage()}
                disabled={loading}
                className="shrink-0 rounded-xl bg-[#D4A843] px-6 py-4 text-sm font-semibold text-[#0f0e0c] transition hover:bg-[#b8872a] disabled:opacity-50 sm:min-h-[52px] sm:min-w-[140px]"
              >
                发送 Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 border-t border-taupe/60 pt-2">
        <button
          type="button"
          onClick={() => {
            setMessages([])
            window.setTimeout(() => beginScenario(), 0)
          }}
          disabled={loading}
          className="rounded-xl border border-taupe bg-elevated px-4 py-2.5 text-sm text-ink transition hover:border-[#D4A843] disabled:opacity-50"
        >
          🔄 New scenario
        </button>
        <button
          type="button"
          onClick={() => setVocabOpen(true)}
          className="rounded-xl border border-taupe bg-elevated px-4 py-2.5 text-sm text-ink transition hover:border-[#D4A843]"
        >
          📖 Show vocabulary
        </button>
        <button
          type="button"
          onClick={handleSaveCorrections}
          className="rounded-xl border border-taupe bg-elevated px-4 py-2.5 text-sm text-ink transition hover:border-[#D4A843]"
        >
          💾 Save corrections
        </button>
      </div>

      {vocabOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="vocab-title"
        >
          <div className="max-h-[70vh] w-full max-w-lg overflow-hidden rounded-2xl border border-taupe bg-[#1C1A16] shadow-xl">
            <div className="flex items-center justify-between border-b border-taupe px-4 py-3">
              <h2 id="vocab-title" className="text-sm font-semibold text-ink">
                HSK {hskLevel} words used this session
              </h2>
              <button
                type="button"
                onClick={() => setVocabOpen(false)}
                className="rounded-lg px-3 py-1 text-sm text-espresso hover:bg-elevated hover:text-ink"
              >
                Close
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto px-4 py-3">
              {hskUsedSorted.length === 0 ? (
                <p className="text-sm text-muted">No HSK words found yet — send a few messages first.</p>
              ) : (
                <div className="space-y-3">
                  {hskUsedSorted.map(({ word, count }) => {
                    const info = hskMeta.get(word)
                    return (
                      <div key={word} className="rounded-xl border border-taupe bg-elevated px-4 py-3">
                        <div className="text-2xl font-normal leading-none text-ink">{word}</div>
                        <div className="mt-1 text-sm text-muted">{pinyinForDisplay(info?.pinyin ?? '')}</div>
                        <div className="mt-1 text-sm text-espresso">{formatEnglishMeaningForDisplay(word, info?.english ?? '')}</div>
                        <div className="mt-2 text-xs text-muted">Used {count} times</div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="mt-4 border-t border-taupe pt-3 text-xs text-muted">
                {hskUsedSorted.length} out of {totalHskWords} HSK {hskLevel} words used this session
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    for (const { word } of hskUsedSorted) {
                      const info = hskMeta.get(word)
                      saveLearnedCharacter({
                        simplified: word,
                        pinyin: info?.pinyin ?? '',
                        meaning: info?.english ?? '',
                        hskLevel,
                      })
                    }
                    setVocabOpen(false)
                  }}
                  disabled={hskUsedSorted.length === 0}
                  className="rounded-xl bg-[#D4A843] px-4 py-2 text-sm font-semibold text-[#0f0e0c] transition hover:bg-[#b8872a] disabled:opacity-50"
                >
                  Save all to flashcards
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
