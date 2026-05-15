import { useId } from 'react'

/** Same lantern art for each; motion/blur/z vary only */
const LANTERNS = [
  {
    left: '5%',
    width: 40,
    dur: 22,
    delay: -2,
    swayDelay: 0.4,
    swayDur: 3.8,
    amp: 10,
    scale: 0.72,
    rotate: -8,
    blur: 2.5,
    z: -5,
    opacity: 0.26,
  },
  {
    left: '17%',
    width: 46,
    dur: 17,
    delay: -14,
    swayDelay: -1.2,
    swayDur: 2.9,
    amp: -12,
    scale: 0.95,
    rotate: 14,
    blur: 0.8,
    z: 1,
    opacity: 0.28,
  },
  {
    left: '29%',
    width: 42,
    dur: 19,
    delay: -6,
    swayDelay: 0.8,
    swayDur: 3.4,
    amp: 9,
    scale: 0.68,
    rotate: 6,
    blur: 3,
    z: -4,
    opacity: 0.25,
  },
  {
    left: '41%',
    width: 52,
    dur: 15,
    delay: -9,
    swayDelay: -0.5,
    swayDur: 2.6,
    amp: -10,
    scale: 1.02,
    rotate: -12,
    blur: 0.4,
    z: 3,
    opacity: 0.3,
  },
  {
    left: '53%',
    width: 38,
    dur: 21,
    delay: -18,
    swayDelay: 1.1,
    swayDur: 3.6,
    amp: 11,
    scale: 0.78,
    rotate: 9,
    blur: 2,
    z: -2,
    opacity: 0.27,
  },
  {
    left: '64%',
    width: 44,
    dur: 18,
    delay: -4,
    swayDelay: -2,
    swayDur: 3.1,
    amp: -9,
    scale: 0.88,
    rotate: -5,
    blur: 1.2,
    z: 0,
    opacity: 0.26,
  },
  {
    left: '76%',
    width: 40,
    dur: 23,
    delay: -11,
    swayDelay: 0.2,
    swayDur: 4,
    amp: 8,
    scale: 0.65,
    rotate: 11,
    blur: 3.2,
    z: -6,
    opacity: 0.25,
  },
  {
    left: '87%',
    width: 36,
    dur: 15,
    delay: -7,
    swayDelay: -1.8,
    swayDur: 2.7,
    amp: -11,
    scale: 0.82,
    rotate: -14,
    blur: 1.5,
    z: -1,
    opacity: 0.27,
  },
  {
    left: '11%',
    width: 34,
    dur: 20,
    delay: -20,
    swayDelay: 2.2,
    swayDur: 3.2,
    amp: 7,
    scale: 0.7,
    rotate: 4,
    blur: 2.8,
    z: -5,
    opacity: 0.25,
  },
  {
    left: '93%',
    width: 40,
    dur: 16,
    delay: -12,
    swayDelay: -0.9,
    swayDur: 3.5,
    amp: -8,
    scale: 0.92,
    rotate: 7,
    blur: 0.6,
    z: 2,
    opacity: 0.29,
  },
]

const RED = {
  body: '#C0392B',
  bodyMid: '#A93226',
  bodyDark: '#7A2E2E',
  rib: '#5C2418',
}

const GOLD = {
  light: '#ECD078',
  mid: '#D4A843',
  deep: '#9A7024',
  stroke: '#5C4A20',
}

/** One classic spherical lantern: gold cap, ribbed red sphere, blossom motifs, fringe, red tassel */
function ClassicLanternSvg({ uniqueId }) {
  const u = uniqueId
  const bodyGrad = `body-${u}`
  const sphereShade = `shade-${u}`
  const capGrad = `capg-${u}`

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 188"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="block h-full w-full drop-shadow-[0_4px_24px_rgba(192,57,43,0.45)]"
    >
      <defs>
        <radialGradient id={bodyGrad} cx="38%" cy="42%" r="68%">
          <stop offset="0%" stopColor="#E74C3C" stopOpacity="0.95" />
          <stop offset="35%" stopColor={RED.body} stopOpacity="1" />
          <stop offset="72%" stopColor={RED.bodyMid} stopOpacity="1" />
          <stop offset="100%" stopColor={RED.bodyDark} stopOpacity="1" />
        </radialGradient>
        <linearGradient id={sphereShade} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f0e6d3" stopOpacity="0.14" />
          <stop offset="45%" stopColor="#f0e6d3" stopOpacity="0" />
          <stop offset="100%" stopColor="#0f0e0c" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={capGrad} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={GOLD.deep} />
          <stop offset="35%" stopColor={GOLD.mid} />
          <stop offset="55%" stopColor={GOLD.light} />
          <stop offset="100%" stopColor={GOLD.deep} />
        </linearGradient>
        <pattern
          id={`cap-flute-${u}`}
          width="5"
          height="100%"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="1"
            y1="0"
            x2="1"
            y2="22"
            stroke={GOLD.stroke}
            strokeWidth="0.55"
            opacity="0.45"
          />
        </pattern>
      </defs>

      {/* hang */}
      <line
        x1="50"
        y1="2"
        x2="50"
        y2="18"
        stroke="#6B6050"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* top cap — fluted gold cylinder */}
      <rect
        x="32"
        y="18"
        width="36"
        height="16"
        rx="3"
        fill={`url(#${capGrad})`}
        stroke={GOLD.stroke}
        strokeWidth="0.9"
      />
      <rect
        x="32"
        y="18"
        width="36"
        height="16"
        rx="3"
        fill={`url(#cap-flute-${u})`}
      />

      {/* main sphere */}
      <ellipse
        cx="50"
        cy="92"
        rx="38"
        ry="41"
        fill={`url(#${bodyGrad})`}
        stroke={RED.bodyDark}
        strokeWidth="1.1"
      />
      <ellipse
        cx="50"
        cy="92"
        rx="38"
        ry="41"
        fill={`url(#${sphereShade})`}
      />

      {/* horizontal ribs (latitude bands) */}
      {[68, 76, 84, 92, 100, 108, 116].map((cy) => {
        const t = (cy - 92) / 41
        if (Math.abs(t) > 1) return null
        const rx = 38 * Math.sqrt(1 - t * t)
        return (
          <ellipse
            key={cy}
            cx="50"
            cy={cy}
            rx={Math.max(rx, 0.5)}
            ry="1.1"
            fill="none"
            stroke={RED.rib}
            strokeWidth="0.85"
            opacity="0.5"
          />
        )
      })}

      {/* small gold blossom clusters */}
      <g fill={GOLD.mid} stroke={GOLD.stroke} strokeWidth="0.35" opacity="0.92">
        <path d="M38 78l1.2 2.2 2.4-.8-1.8 1.8 1.4 2.2-2.6-.6-2.1 1.7-.2-2.7-2.6-.8 2.2-1.4-.1-2.6 2.5z" />
        <circle cx="39" cy="79" r="1.1" fill={GOLD.light} stroke="none" />
        <path d="M62 86l1.2 2.2 2.4-.8-1.8 1.8 1.4 2.2-2.6-.6-2.1 1.7-.2-2.7-2.6-.8 2.2-1.4-.1-2.6 2.5z" />
        <circle cx="63" cy="87" r="1.1" fill={GOLD.light} stroke="none" />
        <path d="M44 98l1 1.8 2-.7-1.5 1.5 1.2 1.8-2.2-.5-1.8 1.4-.2-2.2-2.2-.7 1.8-1.2 0-2.2 2z" />
        <path d="M58 104l1 1.8 2-.7-1.5 1.5 1.2 1.8-2.2-.5-1.8 1.4-.2-2.2-2.2-.7 1.8-1.2 0-2.2 2z" />
        <path d="M36 108l1 1.8 2-.7-1.5 1.5 1.2 1.8-2.2-.5-1.8 1.4-.2-2.2-2.2-.7 1.8-1.2 0-2.2 2z" />
      </g>

      {/* bottom gold collar */}
      <rect
        x="34"
        y="128"
        width="32"
        height="12"
        rx="2"
        fill={`url(#${capGrad})`}
        stroke={GOLD.stroke}
        strokeWidth="0.8"
      />
      <rect
        x="34"
        y="128"
        width="32"
        height="12"
        rx="2"
        fill={`url(#cap-flute-${u})`}
        opacity="0.5"
      />

      {/* gold fringe */}
      <g stroke={GOLD.mid} strokeLinecap="round">
        {Array.from({ length: 28 }, (_, i) => {
          const x = 33 + i * 1.25
          return (
            <line
              key={i}
              x1={x}
              y1="140"
              x2={x + (i % 3 === 0 ? 0.3 : -0.2)}
              y2="156"
              strokeWidth="0.75"
              opacity="0.85"
            />
          )
        })}
      </g>

      {/* bead + red tassel */}
      <circle cx="50" cy="158" r="3" fill={GOLD.mid} stroke={GOLD.stroke} strokeWidth="0.5" />
      <path
        d="M50 161 C46 166 44 172 46 178 C48 182 52 182 54 178 C56 172 54 166 50 161Z"
        fill={RED.bodyMid}
        stroke={RED.rib}
        strokeWidth="0.6"
      />
      <ellipse cx="50" cy="174" rx="4" ry="5" fill={RED.body} opacity="0.95" />
    </svg>
  )
}

function FloatingLantern({ cfg }) {
  const id = useId().replace(/:/g, '')
  const riseStyle = {
    left: cfg.left,
    width: cfg.width,
    minHeight: 168,
    zIndex: cfg.z,
    '--lantern-opacity': String(cfg.opacity),
    '--lantern-dur': `${cfg.dur}s`,
    '--lantern-delay': `${cfg.delay}s`,
    '--lantern-blur': `${cfg.blur}px`,
  }
  const bobStyle = {
    transform: `scale(${cfg.scale}) rotate(${cfg.rotate}deg)`,
    transformOrigin: 'center bottom',
    transformStyle: 'preserve-3d',
  }
  const swayStyle = {
    '--lantern-sway-dur': `${cfg.swayDur}s`,
    '--lantern-sway-delay': `${cfg.swayDelay ?? 0}s`,
    '--lantern-amp': `${cfg.amp}px`,
  }

  return (
    <div className="lantern-rise pointer-events-none" style={riseStyle}>
      <div className="lantern-bob h-full w-full" style={bobStyle}>
        <div className="lantern-sway h-full w-full" style={swayStyle}>
          <ClassicLanternSvg uniqueId={id} />
        </div>
      </div>
    </div>
  )
}

export default function LanternBackground() {
  return (
    <div
      className="lantern-perspective-wrap pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      aria-hidden
    >
      {LANTERNS.map((cfg, i) => (
        <FloatingLantern key={i} cfg={cfg} />
      ))}
    </div>
  )
}
