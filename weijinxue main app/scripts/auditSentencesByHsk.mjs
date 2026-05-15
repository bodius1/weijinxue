/**
 * Audit sentence pools against cumulative HSK 1…N vocabulary (greedy longest-word strip).
 *
 * Usage:
 *   node scripts/auditSentencesByHsk.mjs 1
 *   node scripts/auditSentencesByHsk.mjs 2
 */

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadJson(relFromMandarinApp) {
  return JSON.parse(readFileSync(join(root, relFromMandarinApp), 'utf8'))
}

const level = Math.min(6, Math.max(1, parseInt(process.argv[2], 10) || 1))

const hskData = {}
for (let i = 1; i <= 6; i += 1) {
  hskData[i] = loadJson(`src/data/hsk${i}.json`)
}

const sentences = loadJson(`src/data/sentences_hsk${level}.json`)

const allowed = new Set()
for (let i = 1; i <= level; i += 1) {
  const arr = Array.isArray(hskData[i]) ? hskData[i] : []
  for (const w of arr) {
    const s = String(w?.simplified ?? '').trim()
    if (s) allowed.add(s)
  }
}

const sortedWords = Array.from(allowed).sort((a, b) => b.length - a.length)

let valid = 0
let invalid = 0

for (const row of sentences) {
  const text = String(row?.chinese ?? row?.zh ?? '').replace(/[。！？!?，,、；;：:\s]/g, '')
  if (!text) continue
  let remaining = text
  for (const word of sortedWords) {
    if (!word) continue
    remaining = remaining.split(word).join('')
  }
  if (remaining.length === 0) {
    valid += 1
  } else {
    invalid += 1
    console.log('INVALID:', {
      chinese: row.chinese || row.zh,
      english: row.english,
      unmatched: remaining,
    })
  }
}

console.log(`\nHSK ${level}: ${valid} valid, ${invalid} invalid out of ${sentences.length} total`)
