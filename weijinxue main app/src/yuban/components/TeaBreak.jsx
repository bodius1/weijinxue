/**
 * @param {{ insight: { body: string }, onDismiss: () => void }} props
 */
export function TeaBreak({ insight, onDismiss }) {
  return (
    <div className="space-y-2 rounded-xl border border-[#D4A843]/40 bg-gradient-to-br from-[#1A1814] to-[#0F0E0C] p-4">
      <div className="text-xs font-medium text-[#D4A843]">🍵 {insight.title || 'Tea Break'}</div>
      <div className="text-sm text-[#E8D5A3]">{insight.body}</div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs text-[#8C7A52] transition-colors hover:text-[#E8D5A3]"
      >
        Back to the story →
      </button>
    </div>
  )
}
