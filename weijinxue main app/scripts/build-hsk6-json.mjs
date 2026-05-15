/**
 * Regenerates src/data/hsk6.json from the HSK6 word list (one entry per line).
 *
 * Usage:
 *   node scripts/build-hsk6-json.mjs [path-or-https-URL]
 *
 * Resolution order:
 *   1) CLI argument (local path or http(s) URL)
 *   2) env HSK6_SOURCE (path or URL)
 *   3) src/data/hsk6-source.txt if it exists
 *   4) default upstream list (same format as the bundled HSK 2012 L6 list)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseHsk6VocabText } from './hsk6Parse.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mandarinRoot = join(__dirname, '..')
const outPath = join(mandarinRoot, 'src', 'data', 'hsk6.json')

const DEFAULT_URL =
  'https://raw.githubusercontent.com/glxxyz/hskhsk.com/main/data/lists/HSK%20Official%20With%20Definitions%202012%20L6.txt'

async function loadRaw(source) {
  if (!source) {
    const official = join(mandarinRoot, 'src', 'data', 'hsk-official-l6.txt')
    const local = join(mandarinRoot, 'src', 'data', 'hsk6-source.txt')
    if (existsSync(official)) return readFileSync(official, 'utf8')
    if (existsSync(local)) return readFileSync(local, 'utf8')
    const res = await fetch(DEFAULT_URL)
    if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${DEFAULT_URL}`)
    return res.text()
  }
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${source}`)
    return res.text()
  }
  return readFileSync(source, 'utf8')
}

async function main() {
  const arg = process.argv[2]
  const env = process.env.HSK6_SOURCE
  const raw = await loadRaw(arg || env || null)

  const rows = parseHsk6VocabText(raw)
  if (rows.length !== 2500) {
    throw new Error(`Expected 2500 entries, got ${rows.length}`)
  }
  if (rows[0].simplified !== '挨' || rows[2499].simplified !== '做主') {
    throw new Error(
      `Unexpected first/last simplified: ${rows[0].simplified} / ${rows[2499].simplified}`,
    )
  }

  writeFileSync(outPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
  console.error(`Wrote ${rows.length} entries to ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
