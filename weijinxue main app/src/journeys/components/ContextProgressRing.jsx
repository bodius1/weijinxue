/**
 * Simple circular progress for a context journey (dependency-free).
 */
export default function ContextProgressRing({
  completedCount = 0,
  totalCount = 1,
  size = 56,
  strokeWidth = 4,
  label,
}) {
  const total = Math.max(1, totalCount)
  const completed = Math.min(completedCount, total)
  const pct = Math.round((completed / total) * 100)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${pct}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(212,168,67,0.15)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#D4A843"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums text-[#D4A843]">{pct}%</span>
    </div>
  )
}
