/**
 * Scans HSK1–HSK6 vocabulary and flags likely-wrong display glosses
 * (same pipeline as TypeTab: pickCedictEntryForWord + formatEnglishMeaningForDisplay).
 *
 * Usage (from mandarin-app/):
 *   node scripts/diagnose-meaning-issues.mjs
 *
 * Writes: src/data/meaning_issues_report.txt
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import cedict from 'cc-cedict'

import { formatEnglishMeaningForDisplay } from '../src/utils/formatEnglishMeaning.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mandarinRoot = join(__dirname, '..')
const outPath = join(mandarinRoot, 'src', 'data', 'meaning_issues_report.txt')

/** @typedef {{ simplified: string, pinyin: string, english: string[] }} CedictEntry */

/** @type {Map<string, CedictEntry[]> | null} */
let cedictEntriesBySimplified = null

function isAllHan(s) {
  return typeof s === 'string' && s.length > 0 && /^[\u4e00-\u9fff]+$/u.test(s)
}

const MARKED_PINYIN_CHAR = new Map([
  ['ā', 'a'],
  ['á', 'a'],
  ['ǎ', 'a'],
  ['à', 'a'],
  ['ē', 'e'],
  ['é', 'e'],
  ['ě', 'e'],
  ['è', 'e'],
  ['ī', 'i'],
  ['í', 'i'],
  ['ǐ', 'i'],
  ['ì', 'i'],
  ['ō', 'o'],
  ['ó', 'o'],
  ['ǒ', 'o'],
  ['ò', 'o'],
  ['ū', 'u'],
  ['ú', 'u'],
  ['ǔ', 'u'],
  ['ù', 'u'],
  ['ü', 'v'],
  ['ǖ', 'v'],
  ['ǘ', 'v'],
  ['ǚ', 'v'],
  ['ǜ', 'v'],
])

function stripMarkedPinyinToAscii(s) {
  let out = ''
  for (const ch of s) {
    out += MARKED_PINYIN_CHAR.get(ch) ?? ch
  }
  return out.replace(/\u00fc/g, 'v')
}

function fullTonelessPinyin(pinyinField) {
  if (!pinyinField || typeof pinyinField !== 'string') return ''
  const lower = pinyinField.trim().toLowerCase()
  const stripped = stripMarkedPinyinToAscii(lower)
  return stripped
    .split(/\s+/)
    .map((syl) => syl.replace(/[1-5]$/i, '').replace(/[^a-z]/g, ''))
    .join('')
}

function ensureCedictSimplifiedIndex() {
  if (cedictEntriesBySimplified) return
  cedictEntriesBySimplified = new Map()
  const all = cedict.data.all
  for (let i = 0; i < all.length; i += 1) {
    const raw = all[i]
    const s = raw[1]
    if (typeof s !== 'string' || !isAllHan(s)) continue
    const entry = cedict.expandValue(raw, false)
    const list = cedictEntriesBySimplified.get(s)
    if (list) list.push(entry)
    else cedictEntriesBySimplified.set(s, [entry])
  }
}

function pickCedictEntryForWord(simplified, disambiguatePinyin) {
  ensureCedictSimplifiedIndex()
  const key = String(simplified ?? '').trim()
  if (!key) return null
  const matches = cedictEntriesBySimplified?.get(key) ?? []
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]
  const prefer = disambiguatePinyin ? fullTonelessPinyin(String(disambiguatePinyin)) : ''
  if (prefer) {
    const hit = matches.find((e) => fullTonelessPinyin(e.pinyin) === prefer)
    if (hit) return hit
  }
  return matches[0]
}

/**
 * Mirrors user-requested bad patterns on the *displayed* string (post-format).
 * @param {string} [simplified] — optional; suppresses false positives (e.g. 姓 → "surname").
 */
function isFlaggedDisplayed(text, simplified) {
  const t = String(text ?? '').trim()
  if (!t) return false
  const simp = String(simplified ?? '').trim()
  const low = t.toLowerCase()
  /** HSK headword 姓 is literally "surname"; gloss "surname" is correct, not a dictionary bug. */
  if (simp === '姓' && (low === 'surname' || low.startsWith('surname '))) return false
  if (t.length > 80) return true
  if (low.startsWith('surname')) return true
  if (low.startsWith('used in')) return true
  if (low.startsWith('see ')) return true
  if (low.startsWith('variant of')) return true
  if (low.startsWith('old variant')) return true
  if (low.startsWith('abbr.')) return true
  if (low.startsWith('also written')) return true
  if (low.includes('surname')) return true
  if (t.includes('|')) return true
  if (/\[[^\]]*\d[^\]]*\]/.test(t)) return true
  return false
}

/** Human-readable which rules matched (for the report). */
function matchedFlagRules(text, simplified) {
  const t = String(text ?? '').trim()
  if (!t) return []
  const simp = String(simplified ?? '').trim()
  const low = t.toLowerCase()
  const rules = []
  if (simp === '姓' && (low === 'surname' || low.startsWith('surname '))) return rules
  if (t.length > 80) rules.push('length>80')
  if (low.startsWith('surname')) rules.push('startsWith:surname')
  if (low.startsWith('used in')) rules.push('startsWith:used in')
  if (low.startsWith('see ')) rules.push('startsWith:see ')
  if (low.startsWith('variant of')) rules.push('startsWith:variant of')
  if (low.startsWith('old variant')) rules.push('startsWith:old variant')
  if (low.startsWith('abbr.')) rules.push('startsWith:abbr.')
  if (low.startsWith('also written')) rules.push('startsWith:also written')
  if (low.includes('surname')) rules.push('contains:surname')
  if (t.includes('|')) rules.push('contains:|')
  if (/\[[^\]]*\d[^\]]*\]/.test(t)) rules.push('bracket+pinyin-digit')
  return rules
}

/** Raw CC-CEDICT slash segment looks like junk (for picking a "should be" sense). */
function isJunkSensePart(part) {
  const t = String(part ?? '').trim()
  if (!t) return true
  const low = t.toLowerCase()
  if (t.length > 80) return true
  if (low.startsWith('surname')) return true
  if (low.startsWith('used in')) return true
  if (low.startsWith('see ')) return true
  if (low.startsWith('variant of')) return true
  if (low.startsWith('old variant')) return true
  if (low.startsWith('abbr.')) return true
  if (low.startsWith('also written')) return true
  if (low.includes('surname')) return true
  if (t.includes('|')) return true
  if (/\[[^\]]*\d[^\]]*\]/.test(t)) return true
  return false
}

function suggestShouldBe(simplified, hskEnglish, cedictEntry) {
  const simp = String(simplified ?? '').trim()
  const hskLine = String(hskEnglish ?? '').trim()
  const tryOrder = []

  if (hskLine) tryOrder.push(hskLine)

  if (cedictEntry?.english?.length) {
    const blob = cedictEntry.english.join(' / ')
    const parts = blob
      .split('/')
      .map((x) => x.trim())
      .filter(Boolean)
    for (const p of parts) {
      if (!tryOrder.includes(p)) tryOrder.push(p)
    }
  }

  for (const raw of tryOrder) {
    const d = formatEnglishMeaningForDisplay(simp, raw)
    if (d && !isFlaggedDisplayed(d, simp)) return d
  }

  const cleanedParts = (cedictEntry?.english?.join(' / ') ?? '')
    .split('/')
    .map((x) => x.trim())
    .filter((p) => p && !isJunkSensePart(p))
  if (cleanedParts.length) {
    const shortest = cleanedParts.reduce((a, b) => (a.length <= b.length ? a : b))
    const d2 = formatEnglishMeaningForDisplay(simp, shortest)
    if (d2 && !isFlaggedDisplayed(d2, simp)) return d2
  }

  return '(manual review — no clean alternate found)'
}

function loadHsk(level) {
  const p = join(mandarinRoot, 'src', 'data', `hsk${level}.json`)
  const raw = JSON.parse(readFileSync(p, 'utf8'))
  if (!Array.isArray(raw)) throw new Error(`Expected array in ${p}`)
  return raw
}

function main() {
  const lines = []
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, total: 0 }

  lines.push('WRONG MEANINGS REPORT')
  lines.push('─────────────────────')
  lines.push('')
  lines.push(
    'Method: For each HSK list word, pick CC-CEDICT row via pickCedictEntryForWord(simplified, HSK pinyin),',
  )
  lines.push(
    'then formatEnglishMeaningForDisplay(simplified, cedictEnglishJoinedOrHskEnglish). Flagged if the final display string matches the criteria below.',
  )
  lines.push('')
  lines.push('Flag rules:')
  lines.push('  - starts with (case-insensitive): surname, used in, see , variant of, old variant, abbr., also written')
  lines.push('  - contains "surname" anywhere')
  lines.push('  - contains "|"')
  lines.push('  - contains bracket segment with digit (pinyin ref noise), e.g. [zhang3]')
  lines.push('  - length > 80 characters')
  lines.push('')
  lines.push(
    'Note: headword 姓 with gloss "surname" is treated as a false positive and is not flagged.',
  )
  lines.push('')
  lines.push('"Should be" is the first acceptable formatEnglishMeaningForDisplay result from:')
  lines.push('  HSK JSON english, then each /-split CC-CEDICT sense (shortest clean segment as fallback).')
  lines.push('')

  for (let level = 1; level <= 6; level += 1) {
    const words = loadHsk(level)
    const sectionIssues = []

    for (const raw of words) {
      const simplified = String(raw?.simplified ?? '').trim()
      const pinyin = String(raw?.pinyin ?? '').trim()
      const hskEnglish = String(raw?.english ?? '').trim()
      if (!simplified) continue

      const ce = pickCedictEntryForWord(simplified, pinyin)
      const rawMeaning = ce ? ce.english.join(' / ') : hskEnglish
      const displayed = formatEnglishMeaningForDisplay(simplified, rawMeaning)

      if (!isFlaggedDisplayed(displayed, simplified)) continue

      counts[level] += 1
      counts.total += 1

      const should = suggestShouldBe(simplified, hskEnglish, ce)
      const pin = pinyin || '(no pinyin)'
      const rules = matchedFlagRules(displayed, simplified)
      const ruleLine = rules.length ? `              matched rules: ${rules.join(', ')}` : ''
      sectionIssues.push(
        `   ${simplified} (${pin}) → currently showing: "${displayed}"`,
      )
      if (ruleLine) sectionIssues.push(ruleLine)
      sectionIssues.push(`              should be: "${should}"`)
      sectionIssues.push('')
    }

    lines.push(`HSK ${level}:`)
    if (sectionIssues.length === 0) {
      lines.push('   (no flagged words)')
      lines.push('')
    } else {
      lines.push(...sectionIssues)
    }
  }

  lines.push('─────────────────────')
  lines.push('SUMMARY')
  lines.push('─────────────────────')
  for (let level = 1; level <= 6; level += 1) {
    lines.push(`HSK ${level}: ${counts[level]} flagged`)
  }
  lines.push(`Overall: ${counts.total} flagged`)
  lines.push('')

  const body = lines.join('\n')
  writeFileSync(outPath, body, 'utf8')
  console.log(`Wrote ${outPath}`)
  console.log(body)
}

main()
