import { H11329 } from './H11329.js'

export const EXAM_REGISTRY = {
  hsk1: {
    level: 1,
    label: 'HSK 1',
    description: '150 words, beginner',
    available: true,
    exams: [{ number: 1, examId: 'H11329', data: H11329 }],
  },
  hsk2: {
    level: 2,
    label: 'HSK 2',
    description: '300 words, elementary',
    available: false,
    exams: [],
  },
  hsk3: {
    level: 3,
    label: 'HSK 3',
    description: '600 words, intermediate',
    available: false,
    exams: [],
  },
}
