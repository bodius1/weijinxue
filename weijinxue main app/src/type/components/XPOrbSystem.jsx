import { useEffect, useRef } from 'react'

/**
 * @param {number} multiplier
 */
function orbColor(multiplier) {
  if (multiplier >= 5) return { fill: '#FF69B4', glow: '#FF69B4' }
  if (multiplier >= 3) return { fill: '#FFF0A0', glow: '#FFD700' }
  if (multiplier >= 2) return { fill: '#90EE90', glow: '#00FF44' }
  return { fill: '#D4A843', glow: '#D4A843' }
}

/**
 * @param {number} x0
 * @param {number} y0
 * @param {number} cpX
 * @param {number} cpY
 * @param {number} x1
 * @param {number} y1
 * @param {number} t
 */
function bezierPoint(x0, y0, cpX, cpY, x1, y1, t) {
  const mt = 1 - t
  return {
    x: mt * mt * x0 + 2 * mt * t * cpX + t * t * x1,
    y: mt * mt * y0 + 2 * mt * t * cpY + t * t * y1,
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {{ fill: string, glow: string }} color
 * @param {number} alpha
 */
function drawOrb(ctx, x, y, size, color, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.shadowBlur = size * 3
  ctx.shadowColor = color.glow
  ctx.fillStyle = color.fill
  ctx.beginPath()
  ctx.arc(x, y, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffffff88'
  ctx.beginPath()
  ctx.arc(x - size * 0.12, y - size * 0.12, size * 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * @param {{
 *   orbEvents: Array<{ id: number, fromX: number, fromY: number }>,
 *   badgeRef: import('react').RefObject<HTMLElement | null>,
 *   multiplier: number,
 * }} props
 */
export function XPOrbSystem({ orbEvents, badgeRef, multiplier }) {
  const canvasRef = useRef(/** @type {HTMLCanvasElement | null} */ (null))
  const activeOrbs = useRef(/** @type {Array<Record<string, unknown>>} */ ([]))
  const rafRef = useRef(0)

  useEffect(() => {
    if (!badgeRef?.current) return
    const badgeRect = badgeRef.current.getBoundingClientRect()
    const toX = badgeRect.left + badgeRect.width / 2
    const toY = badgeRect.top + badgeRect.height / 2
    const color = orbColor(multiplier)

    for (const event of orbEvents) {
      if (activeOrbs.current.find((o) => o.id === event.id)) continue

      const cpX = (event.fromX + toX) / 2 + (Math.random() - 0.5) * 80
      const cpY = Math.min(event.fromY, toY) - 60 - Math.random() * 40

      activeOrbs.current.push({
        id: event.id,
        fromX: event.fromX,
        fromY: event.fromY,
        toX,
        toY,
        cpX,
        cpY,
        t: 0,
        speed: 0.022 + Math.random() * 0.01,
        size: 5 + Math.random() * 3,
        alpha: 1,
        color,
        alive: true,
      })
    }

    const liveIds = new Set(orbEvents.map((e) => e.id))
    for (const o of activeOrbs.current) {
      if (!liveIds.has(/** @type {number} */ (o.id))) {
        o.alive = false
      }
    }
  }, [orbEvents, badgeRef, multiplier])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      activeOrbs.current = activeOrbs.current.filter((o) => {
        if (!o.alive) {
          o.alpha = /** @type {number} */ (o.alpha) - 0.08
          return o.alpha > 0
        }
        return o.t <= 1
      })

      for (const orb of activeOrbs.current) {
        const t = Math.min(/** @type {number} */ (orb.t), 1)
        const { x, y } = bezierPoint(
          /** @type {number} */ (orb.fromX),
          /** @type {number} */ (orb.fromY),
          /** @type {number} */ (orb.cpX),
          /** @type {number} */ (orb.cpY),
          /** @type {number} */ (orb.toX),
          /** @type {number} */ (orb.toY),
          t,
        )

        if (!orb.alive) {
          drawOrb(ctx, x, y, /** @type {number} */ (orb.size), /** @type {{ fill: string, glow: string }} */ (orb.color), /** @type {number} */ (orb.alpha))
          continue
        }

        orb.t = /** @type {number} */ (orb.t) + /** @type {number} */ (orb.speed)
        orb.alpha =
          orb.t < 0.1 ? orb.t * 10 : orb.t > 0.85 ? 1 - (orb.t - 0.85) * 6.7 : 1

        drawOrb(ctx, x, y, /** @type {number} */ (orb.size), /** @type {{ fill: string, glow: string }} */ (orb.color), /** @type {number} */ (orb.alpha))
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-40" aria-hidden />
}
