/** @param {{ patternLabel?: string | null }} props */
export function WeaknessBadge({ patternLabel }) {
  if (!patternLabel) return null
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-[#D4A843]/10 px-2 py-0.5 text-[10px] text-[#D4A843]/70">
      🎯 Practicing: {patternLabel}
    </div>
  )
}
