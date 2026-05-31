import { Check, X } from './examIcons.jsx'
import { ANSWER_FALSE, ANSWER_TRUE } from './examAnswerValues.js'
import { isUnanswered } from './reviewStyles.js'

const VARIANTS = {
  correct: {
    label: 'CORRECT',
    border: '#D4A843',
    color: '#D4A843',
  },
  wrong: {
    label: 'YOUR ANSWER',
    border: '#E24B4A',
    color: '#E24B4A',
  },
  unanswered: {
    label: 'NOT ANSWERED',
    border: '#8C7A52',
    color: '#8C7A52',
  },
}

function SymbolContent({ variant, symbol }) {
  const color = VARIANTS[variant].color
  if (symbol === ANSWER_TRUE) {
    return <Check size={28} strokeWidth={2.5} color={color} aria-hidden />
  }
  if (symbol === ANSWER_FALSE) {
    return <X size={28} strokeWidth={2.5} color={color} aria-hidden />
  }
  return (
    <span className="text-[26px] font-medium leading-none" style={{ color }}>
      {symbol}
    </span>
  )
}

function AnswerCard({ variant, symbol }) {
  const v = VARIANTS[variant]
  return (
    <div
      className="flex min-w-[5.5rem] flex-col items-center gap-1.5 rounded-[10px] bg-[#1A1814] px-4 py-3"
      style={{ border: `1.5px solid ${v.border}` }}
    >
      <span
        className="text-[10px] font-medium tracking-[0.08em]"
        style={{ color: v.color }}
      >
        {v.label}
      </span>
      <SymbolContent variant={variant} symbol={symbol} />
    </div>
  )
}

/**
 * @param {{ userAnswer?: string | null, correctAnswer?: string | null, formatSymbol?: (value: string) => string }} props
 */
export default function ReviewAnswerCards({ userAnswer, correctAnswer, formatSymbol = (x) => x }) {
  const unanswered = isUnanswered(userAnswer)
  const correct = correctAnswer ?? ''
  const userOk = !unanswered && userAnswer === correctAnswer

  const correctSymbol = formatSymbol(correct)
  const userSymbol = unanswered ? '—' : formatSymbol(userAnswer ?? '')

  if (userOk) {
    return (
      <div className="mt-4 flex justify-center">
        <AnswerCard variant="correct" symbol={correctSymbol} />
      </div>
    )
  }

  if (unanswered) {
    return (
      <div className="mt-4 flex flex-row flex-wrap justify-center gap-[10px]">
        <AnswerCard variant="correct" symbol={correctSymbol} />
        <AnswerCard variant="unanswered" symbol={userSymbol} />
      </div>
    )
  }

  return (
    <div className="mt-4 flex flex-row flex-wrap justify-center gap-[10px]">
      <AnswerCard variant="correct" symbol={correctSymbol} />
      <AnswerCard variant="wrong" symbol={userSymbol} />
    </div>
  )
}
