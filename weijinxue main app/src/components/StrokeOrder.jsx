import HanziWriter from 'hanzi-writer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const WRITER_OPTS = {
  width: 200,
  height: 200,
  padding: 5,
  showOutline: true,
  strokeColor: '#F0E6D3',
  highlightColor: '#D4A843',
  outlineColor: '#3A3529',
}

function loopAnimate(writer, isAlive) {
  const step = () => {
    if (!isAlive()) return
    writer.animateCharacter({
      onComplete: () => {
        if (!isAlive()) return
        step()
      },
    })
  }
  step()
}

export default function StrokeOrder({ characters, isOpen }) {
  const mountRefs = useRef([])
  const writersRef = useRef([])
  const [error, setError] = useState(null)

  const charsKey = useMemo(
    () => (Array.isArray(characters) ? characters.join('\u0000') : ''),
    [characters],
  )

  const teardownAll = useCallback(() => {
    for (const w of writersRef.current) {
      if (w && typeof w.cancelQuiz === 'function') {
        try {
          w.cancelQuiz()
        } catch {
          /* ignore */
        }
      }
    }
    writersRef.current = []
    mountRefs.current.forEach((el) => {
      if (el) el.innerHTML = ''
    })
  }, [])

  useEffect(() => {
    if (!isOpen) {
      teardownAll()
      queueMicrotask(() => setError(null))
      return
    }

    const list = Array.isArray(characters) ? characters.filter(Boolean) : []
    if (!list.length) return

    teardownAll()
    queueMicrotask(() => setError(null))

    let alive = true
    const isAlive = () => alive
    const writers = []
    let loadError = false

    list.forEach((ch, i) => {
      const el = mountRefs.current[i]
      if (!el) return
      el.innerHTML = ''

      const writer = HanziWriter.create(el, ch, {
        ...WRITER_OPTS,
        onLoadCharDataSuccess: () => {
          if (!isAlive()) return
          loopAnimate(writer, isAlive)
        },
        onLoadCharDataError: () => {
          if (!isAlive() || loadError) return
          loadError = true
          queueMicrotask(() => setError('Stroke data unavailable for one or more characters.'))
          teardownAll()
        },
      })
      writers.push(writer)
    })

    writersRef.current = writers

    return () => {
      alive = false
      teardownAll()
    }
  }, [isOpen, charsKey, characters, teardownAll])

  const list = Array.isArray(characters) ? characters.filter(Boolean) : []

  return (
    <div
      className="flex flex-col items-center gap-3 px-2 pb-4 pt-1"
      id="stroke-order-panel"
    >
      {error ? (
        <p className="max-w-md px-3 text-center text-xs text-espresso/90">{error}</p>
      ) : null}

      <div
        key={charsKey}
        className="flex w-full max-w-full flex-wrap justify-center gap-3 overflow-x-auto py-1"
        aria-live="polite"
      >
        {list.map((ch, i) => (
          <div
            key={`${ch}-${i}`}
            className="flex h-[200px] w-[200px] shrink-0 flex-col items-center justify-center rounded-lg border border-taupe bg-elevated shadow-sm"
          >
            <div
              ref={(el) => {
                mountRefs.current[i] = el
              }}
              className="hanzi-writer-target h-full w-full"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
