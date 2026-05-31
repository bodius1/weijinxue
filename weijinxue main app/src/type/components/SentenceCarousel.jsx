import { useEffect, useRef, useState } from 'react'

const ROW_GAP_PX = 10
const FADE_MS = 200

const PREVIEW_MASK = {
  maskImage:
    'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.6) 65%, black 100%)',
  WebkitMaskImage:
    'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.2) 30%, rgba(0,0,0,0.6) 65%, black 100%)',
}

/** Fixed preview slots — offset into sentenceQueue (0 = current). */
const PREVIEW_ROWS = [
  { offset: 3, fontSize: '1.1rem', minHeight: '1.35em' },
  { offset: 2, fontSize: '1.35rem', minHeight: '1.5em' },
  { offset: 1, fontSize: '1.6rem', minHeight: '1.65em' },
]

/**
 * @param {{
 *   sentenceQueue: string[],
 *   activeInput: import('react').ReactNode,
 *   completedCount: number,
 * }} props
 */
export function SentenceCarousel({ sentenceQueue, activeInput, completedCount }) {
  const prevCompleted = useRef(completedCount)
  const [previewFading, setPreviewFading] = useState(false)

  useEffect(() => {
    if (completedCount === prevCompleted.current) return
    prevCompleted.current = completedCount
    setPreviewFading(true)
    const id = window.setTimeout(() => setPreviewFading(false), FADE_MS)
    return () => window.clearTimeout(id)
  }, [completedCount])

  return (
    <div className="relative w-full select-none overflow-visible">
      <div className="flex w-full flex-col items-center" style={{ gap: ROW_GAP_PX }}>
        <div
          className="pointer-events-none flex w-full flex-col items-center overflow-visible"
          style={{ gap: ROW_GAP_PX, ...PREVIEW_MASK }}
        >
          {PREVIEW_ROWS.map(({ offset, fontSize, minHeight }) => (
            <div
              key={offset}
              className="flex w-full max-w-full items-center justify-center text-center font-mono font-medium leading-snug tracking-wide"
              style={{ fontSize, minHeight, color: '#A8956A' }}
            >
              <span
                className="max-w-full transition-opacity ease-out"
                style={{
                  opacity: previewFading ? 0.35 : 1,
                  transform: previewFading ? 'translateY(6px)' : 'translateY(0)',
                  transitionProperty: 'opacity, transform',
                  transitionDuration: `${FADE_MS}ms`,
                  transitionTimingFunction: 'ease-out',
                }}
              >
                {sentenceQueue[offset] ?? '\u00a0'}
              </span>
            </div>
          ))}
        </div>

        <div className="w-full min-h-[11.5rem] overflow-visible [&_.leading-tight]:text-[2.2rem] [&_.leading-tight]:leading-tight">
          {activeInput}
        </div>
      </div>
    </div>
  )
}

