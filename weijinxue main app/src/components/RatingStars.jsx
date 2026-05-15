const STAR_PATH =
  'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.611l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z'

function Star({ filled }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={filled ? 'text-clay' : 'text-muted'}
      aria-hidden
    >
      <path
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        d={STAR_PATH}
      />
    </svg>
  )
}

export default function RatingStars({ value, onChange, className = '' }) {
  return (
    <div
      className={`flex justify-center gap-1.5 ${className}`}
      role="radiogroup"
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className="h-9 w-9 rounded-md text-espresso transition hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
          onClick={() => onChange(n)}
        >
          <Star filled={value >= n} />
        </button>
      ))}
    </div>
  )
}
