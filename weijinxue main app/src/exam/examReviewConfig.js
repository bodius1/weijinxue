export const REVIEW_SECTIONS = [
  { id: 'listening_part1', label: 'Listening Part 1 (Q1–5)', qStart: 1, qEnd: 5, sectionLabel: 'Listening — Part 1', audioKey: 'part1' },
  { id: 'listening_part2', label: 'Listening Part 2 (Q6–10)', qStart: 6, qEnd: 10, sectionLabel: 'Listening — Part 2', audioKey: 'part2' },
  { id: 'listening_part3', label: 'Listening Part 3 (Q11–15)', qStart: 11, qEnd: 15, sectionLabel: 'Listening — Part 3', audioKey: 'part3' },
  { id: 'listening_part4', label: 'Listening Part 4 (Q16–20)', qStart: 16, qEnd: 20, sectionLabel: 'Listening — Part 4', audioKey: 'part4' },
  { id: 'reading_part1', label: 'Reading Part 1 (Q21–25)', qStart: 21, qEnd: 25, sectionLabel: 'Reading — Part 1' },
  { id: 'reading_part2', label: 'Reading Part 2 (Q26–30)', qStart: 26, qEnd: 30, sectionLabel: 'Reading — Part 2' },
  { id: 'reading_part3', label: 'Reading Part 3 (Q31–35)', qStart: 31, qEnd: 35, sectionLabel: 'Reading — Part 3' },
  { id: 'reading_part4', label: 'Reading Part 4 (Q36–40)', qStart: 36, qEnd: 40, sectionLabel: 'Reading — Part 4' },
]

/** @param {number} q */
export function sectionForQuestion(q) {
  return REVIEW_SECTIONS.find((s) => q >= s.qStart && q <= s.qEnd) ?? REVIEW_SECTIONS[0]
}
