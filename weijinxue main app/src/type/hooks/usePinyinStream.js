import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Strips tone numbers and diacritics from a pinyin string.
 * "nǐ" → "ni", "hǎo" → "hao", "ni3" → "ni", "zhè" → "zhe", "duì" → "dui"
 */
export function stripTones(pinyin) {
  return String(pinyin ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0-9]/g, '')
    .replace(/ü/g, 'u')
    .replace(/\u00fc/g, 'u')
    .replace(/v/g, 'u')
    .toLowerCase()
    .trim()
}

/**
 * @param {string} expected
 * @param {string} buffer
 * @returns {'empty' | 'prefix' | 'match' | 'error'}
 */
export function getMatchStatus(expected, buffer) {
  const exp = stripTones(expected)
  const buf = stripTones(buffer)
  if (!buf) return 'empty'
  if (exp === buf) return 'match'
  if (exp.startsWith(buf)) return 'prefix'
  return 'error'
}

/**
 * @param {string[]} syllables
 * @param {() => void} [onComplete]
 * @param {{ onCharConfirmed?: (index: number) => void, onCharError?: (index: number) => void }} [opts]
 */
export function usePinyinStream(syllables, onComplete, opts = {}) {
  const onCharConfirmedRef = useRef(opts.onCharConfirmed)
  const onCharErrorRef = useRef(opts.onCharError)
  const lastStatusRef = useRef(/** @type {'empty' | 'prefix' | 'match' | 'error'} */ ('empty'))
  onCharConfirmedRef.current = opts.onCharConfirmed
  onCharErrorRef.current = opts.onCharError

  const [currentIndex, setCurrentIndex] = useState(0)
  const [buffer, setBuffer] = useState('')
  const [bufferStatus, setBufferStatus] = useState(/** @type {'empty' | 'prefix' | 'match' | 'error'} */ ('empty'))
  const [charStates, setCharStates] = useState(() =>
    syllables.map((_, i) => (i === 0 ? 'active' : 'waiting')),
  )

  const syllableKey = syllables.join('|')

  useEffect(() => {
    setCurrentIndex(0)
    setBuffer('')
    setBufferStatus('empty')
    lastStatusRef.current = 'empty'
    setCharStates(syllables.map((_, i) => (i === 0 ? 'active' : 'waiting')))
  }, [syllableKey, syllables])

  const handleInput = useCallback(
    (newBuffer) => {
      if (currentIndex >= syllables.length) return

      const expected = syllables[currentIndex]
      const status = getMatchStatus(expected, newBuffer)

      setBuffer(newBuffer)
      setBufferStatus(status)

      if (status === 'match') {
        onCharConfirmedRef.current?.(currentIndex)
        const nextIndex = currentIndex + 1

        setCharStates((prev) => {
          const next = [...prev]
          next[currentIndex] = 'correct'
          if (nextIndex < syllables.length) {
            next[nextIndex] = 'active'
          }
          return next
        })

        setBuffer('')
        setBufferStatus('empty')
        setCurrentIndex(nextIndex)
        lastStatusRef.current = 'empty'

        if (nextIndex >= syllables.length) {
          window.setTimeout(() => onComplete?.(), 300)
        }
      } else if (status === 'error') {
        if (lastStatusRef.current !== 'error') {
          onCharErrorRef.current?.(currentIndex)
        }
        setCharStates((prev) => {
          const next = [...prev]
          next[currentIndex] = 'error'
          return next
        })
        lastStatusRef.current = 'error'
      } else {
        setCharStates((prev) => {
          const next = [...prev]
          next[currentIndex] = 'active'
          return next
        })
        lastStatusRef.current = status
      }
    },
    [currentIndex, syllables, onComplete],
  )

  const handleBackspace = useCallback(() => {
    handleInput(buffer.slice(0, -1))
  }, [buffer, handleInput])

  return {
    buffer,
    bufferStatus,
    charStates,
    currentIndex,
    handleInput,
    handleBackspace,
  }
}
