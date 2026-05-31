import { useEffect, useRef } from 'react'

const GOLD = '#D4A843'

/**
 * @param {number} multiplier
 */
function tierConfig(multiplier) {
  if (multiplier < 2) return null
  if (multiplier >= 5) {
    return { count: 35, speed: 1.25, brightness: 1 }
  }
  if (multiplier >= 3) {
    const t = (multiplier - 3) / 2
    return {
      count: Math.round(20 + t * 15),
      speed: 1 + t * 0.2,
      brightness: 0.85 + t * 0.15,
    }
  }
  const t = (multiplier - 2) / 1
  return {
    count: Math.round(12 + t * 8),
    speed: 0.85 + t * 0.15,
    brightness: 0.7 + t * 0.15,
  }
}

/**
 * @param {number} w
 * @param {number} h
 * @param {number} speedScale
 */
function spawnParticle(w, h, speedScale) {
  return {
    baseX: Math.random() * Math.max(1, w),
    y: h + Math.random() * 24,
    risePxPerSec: (22 + Math.random() * 14) * speedScale,
    driftAmp: 8 + Math.random() * 10,
    driftHz: 0.35 + Math.random() * 0.25,
    phase: Math.random() * Math.PI * 2,
    pulseHz: 0.45 + Math.random() * 0.2,
    pulsePhase: Math.random() * Math.PI * 2,
    size: 2 + Math.random() * 2,
  }
}

/**
 * @param {ReturnType<typeof spawnParticle>} p
 * @param {number} w
 * @param {number} h
 * @param {number} speedScale
 */
function respawnParticle(p, w, h, speedScale) {
  const next = spawnParticle(w, h, speedScale)
  Object.assign(p, next)
}

/**
 * @param {number} y
 * @param {number} h
 */
function verticalAlpha(y, h) {
  const fromTop = Math.min(1, y / Math.max(1, h * 0.34))
  const fromBottom = Math.min(1, (h - y) / 56)
  return Math.max(0, Math.min(1, fromTop * fromBottom))
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @param {number} alpha
 */
function drawDot(ctx, x, y, r, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = GOLD
  ctx.shadowColor = GOLD
  ctx.shadowBlur = r * 2
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * @param {{
 *   multiplier: number,
 *   containerRef: import('react').RefObject<HTMLElement | null>,
 * }} props
 */
export function AmbientParticles({ multiplier, containerRef }) {
  const canvasRef = useRef(/** @type {HTMLCanvasElement | null} */ (null))
  const particlesRef = useRef(/** @type {ReturnType<typeof spawnParticle>[]} */ ([]))
  const sizeRef = useRef({ w: 0, h: 0 })
  const elapsedRef = useRef(0)
  const rafRef = useRef(0)
  const configRef = useRef(/** @type {ReturnType<typeof tierConfig>} */ (null))

  const active = multiplier >= 2
  configRef.current = tierConfig(multiplier)

  useEffect(() => {
    const el = containerRef.current
    const canvas = canvasRef.current
    if (!el || !canvas) return undefined

    const syncSize = () => {
      const { width, height } = el.getBoundingClientRect()
      const w = Math.max(1, width)
      const h = Math.max(1, height)
      sizeRef.current = { w, h }
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.imageSmoothingEnabled = true
      }
    }

    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      return undefined
    }

    const cfg = tierConfig(multiplier)
    if (!cfg) return undefined

    const { w, h } = sizeRef.current
    const pool = particlesRef.current
    while (pool.length < cfg.count) {
      pool.push(spawnParticle(w, h, cfg.speed))
    }
    if (pool.length > cfg.count) pool.length = cfg.count
    for (let i = 0; i < pool.length; i += 1) {
      if (!pool[i]) pool[i] = spawnParticle(w, h, cfg.speed)
    }

    let last = performance.now()
    elapsedRef.current = 0

    const tick = (now) => {
      const cfgNow = configRef.current ?? tierConfig(multiplier)
      if (!cfgNow) return

      const rawDt = (now - last) / 1000
      last = now
      const dt = Math.min(0.033, Math.max(0.001, rawDt))
      elapsedRef.current += dt

      const { w: cw, h: ch } = sizeRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx || cw < 1 || ch < 1) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      ctx.clearRect(0, 0, cw, ch)
      const elapsed = elapsedRef.current
      const twoPi = Math.PI * 2

      for (let i = 0; i < pool.length; i += 1) {
        const p = pool[i]
        if (!p) continue

        p.y -= p.risePxPerSec * dt
        const x = p.baseX + Math.sin(twoPi * p.driftHz * elapsed + p.phase) * p.driftAmp

        if (p.y < -p.size) {
          respawnParticle(p, cw, ch, cfgNow.speed)
          continue
        }

        const pulse = 0.5 + 0.5 * Math.sin(twoPi * p.pulseHz * elapsed + p.pulsePhase)
        const alpha = verticalAlpha(p.y, ch) * (0.35 + 0.65 * pulse) * 0.42 * cfgNow.brightness
        if (alpha <= 0.01) continue

        drawDot(ctx, x, p.y, p.size, alpha)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [active, multiplier])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-500 ease-out"
      style={{ opacity: active ? 1 : 0 }}
      aria-hidden
    />
  )
}
