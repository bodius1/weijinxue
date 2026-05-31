import { Check, X } from './examIcons.jsx'
import { ANSWER_FALSE, ANSWER_TRUE } from './examAnswerValues.js'
import { choiceIconColor, choiceOptionClasses } from './reviewStyles.js'

const OPTIONS = [
  { value: ANSWER_TRUE, Icon: Check },
  { value: ANSWER_FALSE, Icon: X },
]

/**
 * @param {{
 *   selected?: string | null,
 *   onSelect: (value: string) => void,
 *   reviewMode?: boolean,
 *   userAnswer?: string | null,
 *   correctAnswer?: string | null,
 *   className?: string,
 * }} props
 */
export default function TrueFalseButtons({
  selected,
  onSelect,
  reviewMode = false,
  userAnswer,
  correctAnswer,
  className = '',
}) {
  const ua = reviewMode ? userAnswer : selected

  return (
    <div className={['mt-4 flex justify-center gap-3', className].filter(Boolean).join(' ')}>
      {OPTIONS.map(({ value, Icon }) => (
        <button
          key={value}
          type="button"
          disabled={reviewMode}
          onClick={() => onSelect(value)}
          className={choiceOptionClasses({
            reviewMode,
            optionLabel: value,
            userAnswer: ua,
            correctAnswer,
            baseClass:
              'flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200',
          })}
          aria-label={value === ANSWER_TRUE ? 'Yes' : 'No'}
        >
          <Icon
            size={20}
            strokeWidth={2.5}
            color={choiceIconColor(reviewMode, value, ua, correctAnswer)}
          />
        </button>
      ))}
    </div>
  )
}
