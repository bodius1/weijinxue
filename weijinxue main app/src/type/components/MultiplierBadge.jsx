import { forwardRef, useEffect, useRef, useState } from 'react'
import { getMultiplier } from '../scoring/scoreHelpers.js'

/**
 * @param {{
 *   score: number,
 *   streak: number,
 *   cpm?: number,
 *   orbArrived?: number,
 * }} props
 */
export const MultiplierBadge = forwardRef(function MultiplierBadge(
  { score, streak, cpm, orbArrived = 0 },
  badgeRef,
) {
  const multiplier = getMultiplier(streak)
  const [bounce, setBounce] = useState(false)
  const [shrink, setShrink] = useState(false)
  const prevStreakRef = useRef(streak)
  const prevOrbRef = useRef(orbArrived)

  useEffect(() => {
    if (orbArrived === prevOrbRef.current) return
    prevOrbRef.current = orbArrived
    setBounce(true)
    const id = window.setTimeout(() => setBounce(false), 300)
    return () => window.clearTimeout(id)
  }, [orbArrived])

  useEffect(() => {
    if (streak < prevStreakRef.current) {
      setShrink(true)
      const id = window.setTimeout(() => setShrink(false), 400)
      prevStreakRef.current = streak
      return () => window.clearTimeout(id)
    }
    prevStreakRef.current = streak
  }, [streak])

  const isRainbow = multiplier >= 5
  const isPulsing = multiplier >= 2

  const multiplierColor =
    {
      1: '#8C7A52',
      1.5: '#D4A843',
      2: '#FFD700',
      3: '#FFF0A0',
      5: null,
    }[multiplier] ?? '#D4A843'

  const scale = bounce ? 'scale-125' : shrink ? 'scale-90' : 'scale-100'

  return (
    <div
      ref={badgeRef}
      className={[
        'flex min-w-[80px] flex-col items-center text-center rounded-xl border px-4 py-2 transition-all duration-200',
        isPulsing ? 'animate-pulse' : '',
        scale,
      ].join(' ')}
      style={{
        background: '#1A1814',
        borderColor: isRainbow ? '#FFD700' : `${multiplierColor}60`,
        boxShadow:
          multiplier >= 2
            ? `0 0 ${multiplier * 6}px ${isRainbow ? '#FFD70044' : `${multiplierColor}44`}`
            : 'none',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <div className="flex w-full flex-col items-center gap-0.5">
        <span
          className={[
            'block w-full text-center text-lg font-bold leading-none',
            isRainbow
              ? 'bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent'
              : '',
          ].join(' ')}
          style={{ color: isRainbow ? undefined : multiplierColor }}
        >
          ×{multiplier}
        </span>
        <span className="block w-full text-center font-mono text-sm font-medium text-[#E8D5A3]">
          {score.toLocaleString()}
        </span>
        <span className="block w-full text-center text-[10px] uppercase tracking-wider text-[#8C7A52]">
          SCORE
        </span>
        {cpm != null ? (
          <>
            <div className="my-1 w-full border-t border-[#D4A843]/20" />
            <span className="block w-full text-center font-mono text-sm font-medium tabular-nums text-[#E8D5A3]">
              {cpm}
            </span>
            <span className="block w-full text-center text-[10px] uppercase tracking-wider text-[#8C7A52]">
              CPM
            </span>
          </>
        ) : null}
      </div>
    </div>
  )
})
