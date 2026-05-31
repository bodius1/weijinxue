import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { usePinyinStream } from '../hooks/usePinyinStream.js'
import { extractSyllables, extractSyllablesFromSentLine, PUNCTUATION, AUTO_SKIP } from '../utils/pinyinSyllables.js'

/**
 * @param {{
 *   sentence: string,
 *   getPinyin?: (char: string) => string | null | undefined,
 *   sentLine?: { chinese: string, cells: unknown[] } | null,
 *   onComplete?: () => void,
 *   onCharConfirmed?: (fromX: number, fromY: number, syllableIndex: number) => void,
 *   onCharError?: (syllableIndex: number) => void,
 *   active?: boolean,
 *   disabled?: boolean,
 *   english?: string,
 *   sentencesCompleted?: number,
 *   multiplier?: number,
 * }} props
 */
export function PinyinStreamInput({
  sentence,
  getPinyin,
  sentLine,
  onComplete,
  onCharConfirmed,
  onCharError,
  active = true,
  disabled = false,
  english = '',
  sentencesCompleted = 0,
  multiplier = 1,
}) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const charSpanRefs = useRef(/** @type {Record<number, HTMLSpanElement | null>} */ ({}))
  const [exitPhase, setExitPhase] = useState(/** @type {null | 'flash' | 'fading'} */ (null))

  const { syllables, charIndices } = useMemo(() => {
    if (sentLine) return extractSyllablesFromSentLine(sentLine)
    return extractSyllables(sentence, getPinyin ?? (() => null))
  }, [sentence, sentLine, getPinyin])

  useEffect(() => {
    charSpanRefs.current = {}
    setExitPhase(null)
  }, [sentence, sentLine?.chinese])

  const handleComplete = useCallback(() => {
    setExitPhase('flash')
    window.setTimeout(() => setExitPhase('fading'), 160)
    window.setTimeout(() => {
      onComplete?.()
      setExitPhase(null)
    }, 560)
  }, [onComplete])

  const handleCharConfirmed = useCallback(
    (syllableIdx) => {
      const charIdx = charIndices[syllableIdx]
      const el = charIdx != null ? charSpanRefs.current[charIdx] : null
      if (el && onCharConfirmed) {
        const r = el.getBoundingClientRect()
        onCharConfirmed(r.left + r.width / 2, r.top + r.height / 2, syllableIdx)
      } else if (onCharConfirmed) {
        onCharConfirmed(0, 0, syllableIdx)
      }
    },
    [charIndices, onCharConfirmed],
  )

  const streamOpts = useMemo(
    () => ({ onCharConfirmed: handleCharConfirmed, onCharError }),
    [handleCharConfirmed, onCharError],
  )

  const { buffer, bufferStatus, charStates, currentIndex, handleInput, handleBackspace } = usePinyinStream(
    syllables,
    handleComplete,
    streamOpts,
  )

  useEffect(() => {
    if (active && !disabled && !exitPhase) inputRef.current?.focus()
  }, [active, disabled, sentence, sentLine?.chinese, exitPhase])

  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
    return () => window.clearTimeout(t)
  }, [sentence])

  if (!syllables.length) {
    return (
      <div className="flex w-full max-w-3xl flex-col items-center gap-2 py-6 text-center text-sm text-[#8C7A52]">
        Unable to load pinyin for this sentence.
      </div>
    )
  }

  const onKeyDown = (e) => {
    if (disabled || exitPhase) return
    if (e.key === 'Backspace') {
      e.preventDefault()
      handleBackspace()
      return
    }
    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault()
      handleInput(buffer + e.key.toLowerCase())
    }
  }

  const fireStreak = multiplier >= 5

  const renderSentence = () => {
    const chars = sentence.split('')
    const indexToSyllable = new Map(charIndices.map((ci, si) => [ci, si]))

    return chars.map((char, i) => {
      if (PUNCTUATION.test(char)) {
        const charsBefore = charIndices.filter((ci) => ci < i).length
        const isPassed = currentIndex >= charsBefore && charsBefore > 0
        const isComplete = currentIndex >= syllables.length

        return (
          <span
            key={i}
            className={
              isPassed || isComplete
                ? 'text-[#D4A843] transition-colors duration-150'
                : 'text-[#8C7A52]'
            }
          >
            {char}
          </span>
        )
      }

      if (AUTO_SKIP.test(char)) {
        return (
          <span key={i} className="text-[#D4A843]">
            {char}
          </span>
        )
      }

      const syllableIdx = indexToSyllable.get(i)
      if (syllableIdx === undefined) {
        return (
          <span key={i} className="text-[#8C7A52]">
            {char}
          </span>
        )
      }

      const state = charStates[syllableIdx] || 'waiting'

      const colorClass = {
        waiting: 'text-[#8C7A52]',
        active: 'text-[#E8D5A3] border-b-2 border-[#D4A843]',
        correct: 'text-[#D4A843]',
        error: 'text-[#E24B4A] border-b-2 border-[#E24B4A]',
      }[state]

      return (
        <span
          key={i}
          ref={(el) => {
            charSpanRefs.current[i] = el
          }}
          className={['transition-colors duration-100', colorClass].join(' ')}
        >
          {char}
        </span>
      )
    })
  }

  const inputBorderColor = {
    empty: 'border-[#D4A843]/30',
    prefix: 'border-[#D4A843]/60',
    match: 'border-[#D4A843]',
    error: 'border-[#E24B4A]',
  }[bufferStatus]

  const inputTextColor = bufferStatus === 'error' ? 'text-[#E24B4A]' : 'text-[#D4A843]'

  const isFading = exitPhase === 'fading'
  const isFlash = exitPhase === 'flash'

  return (
    <div
      className={[
        'flex w-full max-w-3xl flex-col items-center gap-2',
        isFading ? 'pointer-events-none' : '',
      ].join(' ')}
    >
      <div
        className={[
          'w-full text-center font-medium leading-tight tracking-wide transition-opacity duration-300 ease-out',
          'text-[clamp(1.75rem,5vw,2.5rem)]',
          isFading ? 'opacity-0' : 'opacity-100',
          !fireStreak && isFlash ? 'drop-shadow-[0_0_12px_#D4A843]' : '',
          fireStreak ? 'fire-text' : '',
        ].join(' ')}
      >
        {renderSentence()}
      </div>

      {english ? (
        <p
          className={[
            'max-w-2xl px-2 text-center text-base text-[#D4A843] transition-opacity duration-500 sm:text-lg',
            isFading ? 'opacity-0' : 'opacity-100',
          ].join(' ')}
        >
          {english}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="text"
        value={buffer}
        readOnly
        disabled={disabled || Boolean(exitPhase)}
        onKeyDown={onKeyDown}
        placeholder="type pinyin…"
        aria-label="Pinyin stream input"
        className={[
          'w-full rounded-lg border bg-[#0F0E0C] px-4 py-3 text-center font-mono text-lg tracking-widest outline-none transition-opacity duration-300 ease-out placeholder-[#8C7A52]/40',
          inputBorderColor,
          inputTextColor,
          disabled || exitPhase ? 'cursor-not-allowed opacity-50' : '',
          isFading ? 'opacity-0' : '',
        ].join(' ')}
      />

      {!buffer && !disabled && !exitPhase ? (
        <p
          className={[
            'text-center text-xs text-[#8C7A52] transition-opacity duration-700 ease-out',
            sentencesCompleted >= 3 ? 'pointer-events-none opacity-0' : 'opacity-100',
          ].join(' ')}
          aria-hidden={sentencesCompleted >= 3}
        >
          type the pinyin — no spaces, no tones needed
        </p>
      ) : null}
    </div>
  )
}
