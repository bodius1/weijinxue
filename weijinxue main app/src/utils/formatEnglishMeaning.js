/**
 * HSK / learner gloss fixes (from meaning diagnosis). Checked before DISPLAY_OVERRIDE
 * and CC-CEDICT slash-split logic. JSON loads via URL at runtime — see {@link preloadFormatEnglishMeaningData}.
 */

/** Must win over HSK4 bulk (and base) — learner corrections for polysemous / grammar headwords. */
const MEANING_OVERRIDE_PRIORITY = Object.freeze({
  得: 'manner particle / must, have to',
  地: 'adverbial particle / ground',
  干: 'dry / to do',
  倒: 'to pour / upside down',
  当: 'when / to act as',
  行: 'OK, alright / capable',
  从来: 'always, ever (usually with negation)',
  理发: 'to get a haircut',
  告诉: 'to tell; to inform',
  咖啡: 'coffee',
  一起: 'together',
  玩: 'to play; to have fun',
  累: 'tired',
  妹妹: 'younger sister',
  宾馆: 'hotel',
  完: 'to finish; to complete; finished; used up',
  每: 'every; each',
  离: 'to be away from; from; to leave',
})

/** @type {Readonly<Record<string, string>>} */
let MEANING_OVERRIDES = Object.freeze({})

/** Optional per-headword pinyin for Type tab (`src/data/pinyin_overrides.json`). */
/** @type {Record<string, string>} */
let PINYIN_OVERRIDES = {}

/** @type {Promise<void> | null} */
let _meaningPreload = null

/**
 * Loads gloss override JSON from `src/data/*.json` via URL (Vite emits separate assets). Call from app bootstrap with other preloads.
 */
export function preloadFormatEnglishMeaningData() {
  if (_meaningPreload) return _meaningPreload
  _meaningPreload = (async () => {
    const names = [
      'meaning_overrides.json',
      'hsk4_overrides_bulk_part1.json',
      'hsk4_overrides_bulk_part2.json',
      'hsk5_overrides_bulk_part1.json',
      'hsk5_overrides_bulk_part2.json',
    ]
    const objs = await Promise.all(
      names.map((n) =>
        fetch(new URL(`../data/${n}`, import.meta.url).href).then((r) => {
          if (!r.ok) throw new Error(`Failed to load ${n}: ${r.status}`)
          return r.json()
        }),
      ),
    )
    const unwrap = (x) => /** @type {any} */ (x)?.default ?? x
    const HSK4_BULK_1 = unwrap(objs[1])
    const HSK4_BULK_2 = unwrap(objs[2])
    const MEANING_BASE = unwrap(objs[0])
    const HSK5_BULK_1 = unwrap(objs[3])
    const HSK5_BULK_2 = unwrap(objs[4])
    MEANING_OVERRIDES = Object.freeze(
      /** @type {any} */ (
        Object.assign({}, HSK4_BULK_1, HSK4_BULK_2, MEANING_BASE, HSK5_BULK_1, HSK5_BULK_2, MEANING_OVERRIDE_PRIORITY)
      ),
    )
    try {
      const pr = await fetch(new URL('../data/pinyin_overrides.json', import.meta.url).href)
      if (pr.ok) {
        const j = await pr.json()
        const raw = unwrap(j)
        PINYIN_OVERRIDES =
          raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}
      }
    } catch {
      PINYIN_OVERRIDES = {}
    }
  })().catch((err) => {
    _meaningPreload = null
    throw err
  })
  return _meaningPreload
}

/**
 * Hardcoded learner glosses (HSK-1 core + common particles).
 * Checked before CC-CEDICT slash-split logic.
 * @type {Readonly<Record<string, string>>}
 */
const DISPLAY_OVERRIDE = {
  年: 'year',
  个: 'measure word (objects)',
  的: 'structural particle',
  了: 'completed action particle',
  是: 'to be',
  我: 'I / me',
  你: 'you',
  他: 'he / him',
  她: 'she / her',
  们: 'plural marker',
  不: 'no / not',
  有: 'to have / there is',
  在: 'at / in / to be',
  来: 'to come',
  去: 'to go',
  吗: 'question particle',
  呢: 'question/pause particle',
  吧: 'suggestion/assumption particle',
  着: 'ongoing action particle',
  过: 'past experience particle',
  把: 'disposal construction particle',
  被: 'passive voice particle',
  让: 'to let / to allow',
}

/** Lowercase: sense line starts with these → not a primary learner gloss. */
const SKIP_SENSE_PREFIXES = [
  'surname',
  'used in',
  'see ',
  'variant of',
  'old variant',
  'also written',
]

/**
 * Bracket blocks (pinyin / cross-refs) and trad|simp pipes — fallback cleanup.
 * @param {string} s
 */
function stripBracketsAndPipes(s) {
  return String(s ?? '')
    .replace(/\[[^\]]*\]/g, '')
    /** CC-CEDICT cross-refs / trad|simp tails that leak without a closing `]` */
    .replace(/\[[^\]]*\|/g, '')
    .replace(/\[[^\]]*$/g, '')
    .replace(/\|+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True if this "/" sense should be excluded from the "good" pool.
 * @param {string} part
 */
function isUncleanSensePart(part) {
  const t = String(part ?? '').trim()
  if (!t) return true
  if (t.length > 80) return true
  const low = t.toLowerCase()
  for (const p of SKIP_SENSE_PREFIXES) {
    if (low.startsWith(p)) return true
  }
  if (t.includes('|')) return true
  if (/\[[^\]]*\d[^\]]*\]/.test(t)) return true
  return false
}

/**
 * Split on "/", drop junk segments, then take the **shortest** remaining sense
 * (core meaning is usually the briefest, e.g. "year" vs "surname Nian").
 * If none qualify, strip noise from the first segment.
 * @param {string} full
 */
function pickCleanCedictEnglish(full) {
  const s = String(full ?? '').trim()
  if (!s) return ''
  const parts = s
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean)
  const good = parts.filter((p) => !isUncleanSensePart(p))
  if (good.length > 0) {
    return good.reduce((a, b) => (a.length <= b.length ? a : b))
  }
  const fallback = parts[0] ?? s
  return stripBracketsAndPipes(fallback)
}

/**
 * If the chosen sense still has learner-style " / " inside one line, keep the first chunk.
 * @param {string} raw
 */
function firstSubsenseBeforeSlashJoin(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  const i = t.indexOf(' / ')
  return i >= 0 ? t.slice(0, i).trim() : t
}

/** @param {string} s */
function truncate60(s) {
  if (s.length <= 60) return s
  return `${s.slice(0, 60).trimEnd()}...`
}

/**
 * Type tab when HSK JSON is source of truth: `pinyin_overrides.json` entry, else HSK `pinyin`.
 * @param {string} simplified
 * @param {string} hskPinyin
 */
export function resolveTypeHskDisplayPinyin(simplified, hskPinyin) {
  const simp = String(simplified ?? '').trim()
  const o = PINYIN_OVERRIDES[simp]
  if (typeof o === 'string' && o.trim()) return o.trim()
  return String(hskPinyin ?? '').trim()
}

/**
 * Type tab when HSK JSON is source of truth: meaning maps from preload, else HSK `english` (no CC-CEDICT parsing).
 * @param {string} simplified
 * @param {string} hskEnglishLine
 */
export function resolveTypeHskMeaningPlain(simplified, hskEnglishLine) {
  const simp = String(simplified ?? '').trim()
  let line = ''
  if (simp && MEANING_OVERRIDES[simp] != null && String(MEANING_OVERRIDES[simp]).trim() !== '') {
    line = String(MEANING_OVERRIDES[simp]).trim()
  } else {
    line = String(hskEnglishLine ?? '').trim()
  }
  return stripBracketsAndPipes(line)
}

/**
 * Same as {@link resolveTypeHskMeaningPlain} but capped for UI.
 * @param {string} simplified
 * @param {string} hskEnglishLine
 */
export function resolveTypeHskDisplayEnglish(simplified, hskEnglishLine) {
  return truncate60(resolveTypeHskMeaningPlain(simplified, hskEnglishLine))
}

/**
 * Display-only English gloss: word overrides, CC-CEDICT junk filtering,
 * shortest clean "/" sense, max 60 chars + "...".
 * Used across TypeTab, Learn (CharacterDisplay), Flashcards, Quiz, QuickQuiz, MultipleChoice, Yuban, etc.
 * @param {string} [simplified] — headword (overrides are usually one character)
 * @param {string | string[]} [english] — joined gloss or Cedict `english` array
 * @returns {string}
 */
export function formatEnglishMeaningForDisplay(simplified, english) {
  const simp = String(simplified ?? '').trim()
  if (simp && MEANING_OVERRIDES[simp]) {
    return truncate60(String(MEANING_OVERRIDES[simp]).trim())
  }
  if (simp && DISPLAY_OVERRIDE[simp]) {
    return DISPLAY_OVERRIDE[simp]
  }
  const raw = Array.isArray(english) ? english.join(' / ') : String(english ?? '')
  const cleaned = pickCleanCedictEnglish(raw)
  const brief = firstSubsenseBeforeSlashJoin(cleaned)
  return truncate60(brief)
}
