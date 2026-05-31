import { useEffect, useState } from 'react'

export const STORAGE_KEY = 'yuban_dev_mode'
export const PANEL_VISIBLE_KEY = 'yuban_dev_panel_visible'

export function isDevModeEnabled() {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function useDevMode() {
  const [enabled, setEnabled] = useState(() => isDevModeEnabled())
  const [panelVisible, setPanelVisible] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return localStorage.getItem(PANEL_VISIBLE_KEY) !== 'false'
    } catch {
      return true
    }
  })

  useEffect(() => {
    const handler = () => setEnabled(isDevModeEnabled())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const togglePanelVisible = () => {
    const next = !panelVisible
    setPanelVisible(next)
    try {
      localStorage.setItem(PANEL_VISIBLE_KEY, next ? 'true' : 'false')
    } catch {
      /* ignore */
    }
  }

  return { enabled, panelVisible, togglePanelVisible }
}
