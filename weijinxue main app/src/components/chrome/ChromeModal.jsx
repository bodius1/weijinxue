import { useEffect, useId } from 'react'

// Intentionally no auto-focus here — callers may focus a specific control (e.g. contact textarea).

/**
 * @param {{
 *   open: boolean
 *   title: string
 *   onClose: () => void
 *   children: import('react').ReactNode
 *   className?: string
 * }} props
 */
export default function ChromeModal({ open, title, onClose, children, className = '' }) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-[#0f0e0c]/85 p-3 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          'max-h-[min(90vh,36rem)] w-full max-w-md overflow-hidden rounded-xl border border-taupe bg-[#1c1a16] shadow-2xl shadow-black/50 ring-1 ring-[#D4A843]/15',
          className,
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-taupe px-3 py-2.5 sm:px-4">
          <h2 id={titleId} className="text-xs font-semibold uppercase tracking-wide text-[#D4A843]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted transition hover:bg-elevated hover:text-[#D4A843]"
            aria-label="Close"
          >
            <span className="block text-lg leading-none text-espresso" aria-hidden>
              ×
            </span>
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4">{children}</div>
      </div>
    </div>
  )
}
