/**
 * Privacy-safe Firebase Analytics helpers.
 * - No message text, search strings, emails, API keys, or typed content in params.
 * - If Analytics is unavailable or fails, all functions no-op silently.
 */
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics'
import { app } from '../firebase.js'

/** @type {Promise<import('firebase/analytics').Analytics | null> | null} */
let analyticsReady = null

/**
 * @returns {Promise<import('firebase/analytics').Analytics | null>}
 */
function resolveAnalytics() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  const mid = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  if (!mid || !String(mid).trim()) return Promise.resolve(null)
  if (!analyticsReady) {
    analyticsReady = isSupported()
      .then((ok) => {
        if (!ok) return null
        try {
          return getAnalytics(app)
        } catch {
          return null
        }
      })
      .catch(() => null)
  }
  return analyticsReady
}

/**
 * Strip or skip values that must never go to Analytics.
 * @param {Record<string, unknown> | undefined} params
 * @returns {Record<string, string | number>}
 */
function sanitizeParams(params) {
  if (!params || typeof params !== 'object') return {}
  const denyKey =
    /email|password|token|api_?key|secret|query_text|message|content_text|user_message|chat_text|pinyin_raw|raw_query|^typed$/i
  /** @type {Record<string, string | number>} */
  const out = {}
  for (const [rawKey, v] of Object.entries(params)) {
    if (denyKey.test(rawKey)) continue
    const key = String(rawKey).slice(0, 40)
    if (v == null) continue
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v
    } else if (typeof v === 'boolean') {
      out[key] = v ? 1 : 0
    } else if (typeof v === 'string') {
      const s = v.slice(0, 100)
      if (!s) continue
      out[key] = s
    }
  }
  return out
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} [params]
 */
export function trackEvent(name, params) {
  const n = String(name || '').slice(0, 40)
  if (!n) return
  void resolveAnalytics()
    .then((analytics) => {
      if (!analytics) return
      try {
        logEvent(analytics, n, sanitizeParams(params))
      } catch {
        /* silent */
      }
    })
    .catch(() => {})
}

/** @param {string} tabName */
export function trackTabView(tabName) {
  trackEvent('tab_view', { tab_name: String(tabName).slice(0, 40) })
}

/**
 * Study-related analytics (aggregate / categorical only).
 * @param {string} type
 * @param {Record<string, unknown>} [params]
 */
export function trackStudyEvent(type, params) {
  trackEvent('study_event', { study_type: String(type).slice(0, 32), ...sanitizeParams(params) })
}

/**
 * @param {string} label
 * @param {string} url
 */
export function trackExternalClick(label, url) {
  trackEvent('external_link_click', {
    link_label: String(label).slice(0, 40),
    link_domain: safeHost(url),
  })
}

/** @param {string} url */
function safeHost(url) {
  try {
    return new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://localhost').hostname.slice(
      0,
      120,
    )
  } catch {
    return 'unknown'
  }
}
