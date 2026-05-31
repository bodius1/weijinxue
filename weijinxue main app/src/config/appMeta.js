/** Display-only app metadata (import from here to avoid duplicating version strings). */
export const APP_VERSION = '1.3.0'
export const APP_VERSION_LABEL = `v${APP_VERSION}`
export const APP_RELEASE_DATE = 'May 31, 2026'

/** @typedef {{ version: string, versionLabel: string, releaseDate: string, title?: string, items: string[] }} ReleaseNote */

/** Newest first — shown in About modal. */
export const RELEASE_HISTORY = /** @type {ReleaseNote[]} */ ([
  {
    version: '1.3.0',
    versionLabel: 'v1.3.0',
    releaseDate: 'May 31, 2026',
    title: 'Yǔbàn story AI, stream typing, XP scoring, and exam review',
    items: [
      'Yǔbàn AI rebuilt with persistent story state, production gap, three-voice grading (老师/朋友/路人), confidence calibration, and adaptive curriculum that targets your specific weaknesses',
      'Type tab now uses continuous stream pinyin input, a 4-row sentence carousel, XP orbs + streak multiplier effects, session scoring with leaderboard, and 251 HSK 1 sentences (up from 70)',
      'Exam tab adds full review mode and attempt history saved to your profile; Journeys mini-drills now accept natural answer variation',
    ],
  },
  {
    version: '1.2.1',
    versionLabel: 'v1.2.1',
    releaseDate: 'May 19, 2026',
    title: 'Pinyin input fix',
    items: [
      'Fixed: typing a single letter (e.g. "z") no longer instantly reveals or accepts the target character — full syllable required (e.g. "zhuo")',
      'Tone selection unchanged: after typing the full syllable, 1–4 or Space still picks the candidate as before',
    ],
  },
  {
    version: '1.2.0',
    versionLabel: 'v1.2.0',
    releaseDate: 'May 19, 2026',
    title: 'Exam cleanup and smarter sentence ordering',
    items: [
      'Exam tab now shows Mock Exams only — Past Exams card removed',
      'Type → Sentences now uses weighted shuffle: recently seen sentences are deprioritized and gradually return to full rotation over 24 hours',
      'Seen history is shared across all HSK sentence levels',
    ],
  },
  {
    version: '1.1.0',
    versionLabel: 'v1.1.0',
    releaseDate: 'May 19, 2026',
    title: 'Exam section, expanded HSK 2 sentences, and profile data views',
    items: [
      'Exam tab with Mock Exams (timed, full-length HSK simulations)',
      '120 HSK 2 typing sentences replacing the old ~50 starter deck',
      'Expanded profile dashboard with custom data viewing for signed-in users',
    ],
  },
  {
    version: '1.0.0',
    versionLabel: 'v1.0.0',
    releaseDate: 'May 15, 2026',
    title: 'Initial release',
    items: [
      'Learn tab with pinyin search, stroke order, and audio',
      'HSK flashcards and spaced repetition',
      'Quiz mode with progress tracking',
      'Type mode inspired by typing practice apps',
      'Yǔbàn AI conversation practice',
      'Open-source and free to use',
    ],
  },
])

export const SUPPORT_URL = 'https://buymeacoffee.com/joaquindh'
export const GITHUB_URL = 'https://github.com/bodius1/weijinxue'
