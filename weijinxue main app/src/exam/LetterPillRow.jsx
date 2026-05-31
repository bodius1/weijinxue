import { choiceOptionClasses } from './reviewStyles.js'

/**
 * @param {{
 *   labels: string[],
 *   selected?: string | null,
 *   onSelect?: (label: string) => void,
 *   reviewMode?: boolean,
 *   userAnswer?: string | null,
 *   correctAnswer?: string | null,
 *   className?: string,
 *   compact?: boolean,
 * }} props
 */
export default function LetterPillRow({
  labels,
  selected,
  onSelect,
  reviewMode = false,
  userAnswer,
  correctAnswer,
  className = '',
  compact = false,
}) {
  const ua = reviewMode ? userAnswer : selected
  const pillBase = compact
    ? 'min-w-0 rounded-md px-2.5 py-0.5 text-center text-xs transition-colors duration-200'
    : 'min-w-9 rounded-md px-3 py-1 text-center text-[13px] transition-colors duration-200'

  return (
    <div className={['flex flex-wrap', compact ? 'gap-1.5' : 'gap-2', className].filter(Boolean).join(' ')}>
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          disabled={reviewMode}
          onClick={() => onSelect?.(label)}
          className={choiceOptionClasses({
            reviewMode,
            optionLabel: label,
            userAnswer: ua,
            correctAnswer,
            baseClass: pillBase,
          })}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
