/** @param {string | null | undefined} userAnswer */
export function isUnanswered(userAnswer) {
  return userAnswer == null || userAnswer === ''
}

/**
 * @param {boolean} reviewMode
 * @param {string} optionLabel
 * @param {string | null | undefined} userAnswer
 * @param {string | null | undefined} correctAnswer
 * @returns {'gold' | 'red' | 'unselected'}
 */
export function resolveOptionStyle(reviewMode, optionLabel, userAnswer, correctAnswer) {
  const isSelected = userAnswer === optionLabel
  const isCorrect = correctAnswer === optionLabel

  if (reviewMode) {
    if (isCorrect) return 'gold'
    if (isSelected && !isCorrect) return 'red'
    return 'unselected'
  }
  if (isSelected) return 'gold'
  return 'unselected'
}

const GOLD =
  'border-[#D4A843] bg-[#D4A843] font-medium text-[#0F0E0C]'
const RED = 'border-[#E24B4A] bg-[#E24B4A] font-medium text-white'
const UNSELECTED =
  'border border-[#D4A843]/40 bg-transparent text-[#E8D5A3]'
const UNSELECTED_HOVER = 'hover:border-[#D4A843] hover:bg-[#D4A843]/10'

/**
 * @param {{ reviewMode?: boolean, optionLabel: string, userAnswer?: string | null, correctAnswer?: string | null, baseClass?: string }} p
 */
export function choiceOptionClasses({
  reviewMode = false,
  optionLabel,
  userAnswer,
  correctAnswer,
  baseClass = '',
}) {
  const style = resolveOptionStyle(reviewMode, optionLabel, userAnswer, correctAnswer)
  const parts = [baseClass]
  if (reviewMode) parts.push('pointer-events-none')
  if (style === 'gold') parts.push(GOLD)
  else if (style === 'red') parts.push(RED)
  else {
    parts.push(UNSELECTED)
    if (!reviewMode) parts.push(UNSELECTED_HOVER)
  }
  return parts.filter(Boolean).join(' ')
}

/** Icon stroke color for Check/X buttons */
export function choiceIconColor(reviewMode, optionValue, userAnswer, correctAnswer) {
  const style = resolveOptionStyle(reviewMode, optionValue, userAnswer, correctAnswer)
  if (style === 'gold') return '#0F0E0C'
  if (style === 'red') return '#ffffff'
  return '#E8D5A3'
}
