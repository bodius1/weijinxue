import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PinyinIMEComposer } from '../../components/PinyinIMEComposer.jsx'
import { usePinyinIME } from '../../hooks/usePinyinIME.js'
import { buildYubanImeContext } from '../ime/yubanImeContext.js'
import { useStoryState } from '../StoryStateContext.jsx'

const NATIVE_IME_KEY = 'yuban_native_ime'

/**
 * @param {{
 *   prompt: string,
 *   expectedHint?: string,
 *   onSubmit: (text: string) => void,
 *   onSkip: () => void,
 *   disabled?: boolean,
 *   resetKey?: number,
 *   npcDialogueHanzi?: string,
 * }} props
 */
export function ProductionGap({
  prompt,
  expectedHint,
  onSubmit,
  onSkip,
  disabled = false,
  resetKey = 0,
  npcDialogueHanzi = '',
}) {
  const { state } = useStoryState()
  const hskLevel = Number(state?.hskLevel ?? 1)
  const [imeHint, setImeHint] = useState('')
  const [nativeMode, setNativeMode] = useState(() => {
    try {
      return localStorage.getItem(NATIVE_IME_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [nativeText, setNativeText] = useState('')
  const nativeRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const submitHandlerRef = useRef(/** @type {() => void} */ (() => {}))

  const imeContext = useMemo(
    () =>
      buildYubanImeContext(state, {
        productionPrompt: prompt,
        expectedHint,
        npcDialogueHanzi,
      }),
    [state, prompt, expectedHint, npcDialogueHanzi],
  )

  const ime = usePinyinIME({
    enabled: !disabled && !nativeMode,
    resetKey,
    hskLevel,
    imeContext,
    onEnter: () => submitHandlerRef.current(),
  })

  useEffect(() => {
    setNativeText('')
    setImeHint('')
  }, [resetKey])

  const toggleNativeMode = useCallback(() => {
    setNativeMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem(NATIVE_IME_KEY, next ? 'true' : 'false')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const handleSubmit = useCallback(() => {
    if (nativeMode) {
      const text = nativeText.trim()
      if (!text) return
      onSubmit(text)
      setNativeText('')
      return
    }

    const result = ime.getHanziForSubmit()
    if (!result.ok) {
      if (result.reason === 'pending_pinyin') {
        setImeHint('Pick a candidate with 1–4 or Space before submitting.')
        window.setTimeout(() => setImeHint(''), 3200)
      }
      return
    }
    setImeHint('')
    onSubmit(result.text)
  }, [ime.getHanziForSubmit, nativeMode, nativeText, onSubmit])

  submitHandlerRef.current = handleSubmit

  useEffect(() => {
    if (disabled) return
    const id = window.setTimeout(() => {
      if (nativeMode) nativeRef.current?.focus()
      else ime.rootRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [disabled, resetKey, nativeMode, ime.rootRef])

  const submitResult = nativeMode
    ? { ok: nativeText.trim().length > 0, text: nativeText.trim(), reason: null }
    : ime.getHanziForSubmit()
  const canSubmit = submitResult.ok && !disabled

  return (
    <div className="space-y-3 rounded-xl border border-[#D4A843]/30 bg-[#1A1814] p-4">
      <div>
        <p className="text-sm font-medium text-[#D4A843]">🎯 Your turn</p>
        <p className="mt-1 text-sm text-[#E8D5A3]">{prompt}</p>
        {expectedHint ? (
          <p className="mt-1 text-xs italic text-[#8C7A52]">Hint: {expectedHint}</p>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-[10px] text-[#8C7A52]">
        <input
          type="checkbox"
          checked={nativeMode}
          onChange={toggleNativeMode}
          disabled={disabled}
          className="rounded border-[#D4A843]/40"
        />
        Use built-in keyboard IME (Microsoft Pinyin / system Chinese input)
      </label>

      {nativeMode ? (
        <textarea
          ref={nativeRef}
          value={nativeText}
          onChange={(e) => setNativeText(e.target.value)}
          disabled={disabled}
          placeholder="Type Chinese using your computer's IME…"
          rows={3}
          className="w-full resize-none rounded-lg border border-[#D4A843]/20 bg-[#0F0E0C] px-3 py-2.5 text-sm text-[#E8D5A3] outline-none focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843]/30 disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
      ) : (
        <PinyinIMEComposer
          ime={ime}
          disabled={disabled}
          variant="night"
          placeholder="Type in pinyin — characters will appear above..."
        />
      )}

      {imeHint ? <p className="text-center text-xs text-[#D4A843]">{imeHint}</p> : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onSkip}
          disabled={disabled}
          className="px-3 py-1.5 text-xs text-[#8C7A52] transition-colors hover:text-[#E8D5A3] disabled:opacity-50"
        >
          I don&apos;t know — show me
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-[#D4A843] px-4 py-1.5 text-sm font-medium text-[#0F0E0C] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit reply
        </button>
      </div>

      <p className="text-center text-[10px] italic text-[#8C7A52]/60">
        Try producing your answer before tapping submit — that&apos;s where the learning happens.
      </p>
    </div>
  )
}
