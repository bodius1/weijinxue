import { useDevMode } from './useDevMode.js'

export function DevModeBadge() {
  const { enabled, panelVisible, togglePanelVisible } = useDevMode()
  if (!enabled) return null

  return (
    <button
      type="button"
      onClick={togglePanelVisible}
      className="inline-flex items-center gap-1 rounded-md border border-purple-500/40 px-2 py-1 text-[10px] text-purple-400 transition hover:bg-purple-500/10"
      title={panelVisible ? 'Hide debug panels' : 'Show debug panels'}
    >
      🔬 Dev {panelVisible ? '· on' : '· hidden'}
    </button>
  )
}
