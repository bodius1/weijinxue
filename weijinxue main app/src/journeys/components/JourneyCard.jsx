import ContextProgressRing from './ContextProgressRing.jsx'

/**
 * @param {{
 *   title: string
 *   chineseTitle?: string
 *   description?: string
 *   stageCount?: number
 *   progressPercent?: number
 *   completedStages?: number
 *   locked?: boolean
 *   comingSoon?: boolean
 *   onClick?: () => void
 * }} props
 */
export default function JourneyCard({
  title,
  chineseTitle,
  description,
  stageCount = 0,
  progressPercent = 0,
  completedStages = 0,
  locked = false,
  comingSoon = false,
  onClick,
}) {
  const disabled = locked || comingSoon
  const pct = locked ? 0 : Math.min(100, Math.max(0, progressPercent))

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={[
        'flex w-full flex-col gap-3 rounded-xl border p-4 text-left transition sm:p-5',
        disabled
          ? 'cursor-not-allowed border-taupe/40 bg-[#1A1814]/40 opacity-75'
          : 'border-[#D4A843]/30 bg-[#1A1814] hover:border-[#D4A843]/55 hover:bg-[#1f1c18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843]/70',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[#E8D5A3] sm:text-lg">{title}</h3>
          {chineseTitle ? (
            <p className="mt-0.5 font-serif text-sm text-[#D4A843]/90">{chineseTitle}</p>
          ) : null}
        </div>
        {!locked ? (
          <ContextProgressRing
            completedCount={completedStages}
            totalCount={stageCount || 1}
            size={52}
            label={`${title} progress`}
          />
        ) : (
          <span
            className="shrink-0 rounded-full border border-taupe/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-espresso"
            aria-hidden
          >
            Locked
          </span>
        )}
      </div>
      {description ? (
        <p className="line-clamp-2 text-sm leading-relaxed text-[#E8D5A3]/75">{description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#D4A843]/80">
        {stageCount > 0 ? <span>{stageCount} stages</span> : null}
        {comingSoon ? <span className="text-espresso">Coming soon</span> : null}
        {!locked && !comingSoon && stageCount > 0 ? (
          <span className="text-[#E8D5A3]/60">{pct}% complete</span>
        ) : null}
      </div>
    </button>
  )
}
