import { useMemo, useState } from 'react'

/**
 * Collapsed-by-default JSON/text block — formats only when expanded (memoized).
 * @param {{
 *   label: string,
 *   value: unknown,
 *   defaultExpanded?: boolean,
 *   highlight?: 'amber',
 *   maxHeight?: string,
 *   onCopy?: () => void,
 * }} props
 */
export function LazyJsonBlock({
  label,
  value,
  defaultExpanded = false,
  highlight,
  maxHeight = 'max-h-80',
  onCopy,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const display = useMemo(() => {
    if (!expanded || value == null) return null
    if (typeof value === 'string') return value
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }, [expanded, value])

  const preview =
    value == null
      ? ''
      : typeof value === 'string'
        ? `${value.length} chars`
        : `${JSON.stringify(value).length} chars (JSON)`

  const bgClass =
    highlight === 'amber' ? 'border-amber-500/30 bg-amber-950/20' : 'border-purple-500/20 bg-black/30'

  return (
    <div className={`rounded border ${bgClass}`}>
      <div
        className="flex cursor-pointer items-center justify-between px-2 py-1 hover:bg-white/5"
        onClick={() => setExpanded((e) => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setExpanded((x) => !x)
        }}
      >
        <span className="text-[11px] font-medium text-purple-300">
          {expanded ? '▼' : '▶'} {label}
          {!expanded && preview ? (
            <span className="ml-2 font-normal text-purple-400/50">({preview})</span>
          ) : null}
        </span>
        {onCopy ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCopy()
            }}
            className="px-1.5 py-0.5 text-[10px] text-purple-400/60 hover:text-purple-300"
          >
            copy
          </button>
        ) : null}
      </div>
      {expanded && display ? (
        <pre
          className={`overflow-auto whitespace-pre-wrap break-words border-t border-purple-500/20 p-2 font-mono text-[10px] text-purple-200 ${maxHeight}`}
        >
          {display}
        </pre>
      ) : null}
    </div>
  )
}
