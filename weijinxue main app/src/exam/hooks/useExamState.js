import { useCallback, useMemo, useState } from 'react'

export const EXAM_SECTIONS = [
  'listening_part1',
  'listening_part2',
  'listening_part3',
  'listening_part4',
  'answer_card',
  'reading_part1',
  'reading_part2',
  'reading_part3',
  'reading_part4',
]

export function useExamState() {
  const [answers, setAnswers] = useState({})
  const [sectionIndex, setSectionIndex] = useState(0)

  const currentSection = EXAM_SECTIONS[sectionIndex] ?? EXAM_SECTIONS[0]
  const isLastSection = sectionIndex >= EXAM_SECTIONS.length - 1
  const canGoPrevious = sectionIndex > 0

  const setAnswer = useCallback((qNum, value) => {
    setAnswers((a) => ({ ...a, [qNum]: value }))
  }, [])

  const goToPreviousSection = useCallback(() => {
    setSectionIndex((i) => Math.max(0, i - 1))
  }, [])

  const goToNextSection = useCallback(() => {
    setSectionIndex((i) => Math.min(EXAM_SECTIONS.length - 1, i + 1))
  }, [])

  const goToSection = useCallback((section) => {
    const next = EXAM_SECTIONS.indexOf(section)
    if (next >= 0) setSectionIndex(next)
  }, [])

  const progress = useMemo(
    () => ({ current: sectionIndex + 1, total: EXAM_SECTIONS.length, percent: ((sectionIndex + 1) / EXAM_SECTIONS.length) * 100 }),
    [sectionIndex],
  )

  return {
    answers,
    currentSection,
    sectionIndex,
    isLastSection,
    canGoPrevious,
    progress,
    setAnswer,
    goToPreviousSection,
    goToNextSection,
    goToSection,
  }
}
