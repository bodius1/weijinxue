/**
 * Pinyin stream matching tests.
 * Run: node test/pinyinStream.test.js
 */
import { stripTones, getMatchStatus } from '../src/type/hooks/usePinyinStream.js'
import {
  resolveStreamSyllable,
  extractSyllablesFromSentLine,
} from '../src/type/utils/pinyinSyllables.js'
import { preloadPinyinImeData, getCedictOrNull } from '../src/utils/pinyinIme.js'

let passed = 0
let failed = 0

function assert(cond, msg) {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${msg}`)
  } else {
    failed += 1
    console.error(`  ✗ ${msg}`)
  }
}

console.log('pinyinStream')

{
  assert(stripTones('zhè') === 'zhe', 'stripTones("zhè") === "zhe"')
  assert(stripTones('duì') === 'dui', 'stripTones("duì") === "dui"')
  assert(stripTones('qǐng') === 'qing', 'stripTones("qǐng") === "qing"')
}

{
  assert(getMatchStatus('zhe', 'zhe') === 'match', 'getMatchStatus exact match')
  assert(getMatchStatus('zhe', 'zh') === 'prefix', 'getMatchStatus prefix')
  assert(getMatchStatus('zhe', 'za') === 'error', 'getMatchStatus error')
}

await preloadPinyinImeData()
if (getCedictOrNull()) {
  assert(resolveStreamSyllable('对', 'he4') === 'dui', 'resolveStreamSyllable 对 → dui (not bad py)')
  assert(resolveStreamSyllable('这', 'he4') === 'zhe', 'resolveStreamSyllable 这 → zhe (not bad py)')

  const line = {
    chinese: '对不起',
    cells: [
      { kind: 'han', expect: '对', py: 'dui4' },
      { kind: 'han', expect: '不', py: 'bu4' },
      { kind: 'han', expect: '起', py: 'qi3' },
    ],
  }
  const { syllables, charIndices } = extractSyllablesFromSentLine(line)
  assert(syllables[0] === 'dui' && syllables[1] === 'bu' && syllables[2] === 'qi', '对不起 syllables')
  assert(charIndices[0] === 0 && charIndices[1] === 1 && charIndices[2] === 2, 'charIndices aligned')

  const fallback = {
    chinese: '这是我爸爸',
    cells: [
      { kind: 'han', expect: '这', py: '' },
      { kind: 'han', expect: '是', py: '' },
      { kind: 'han', expect: '我', py: '' },
      { kind: 'han', expect: '爸', py: '' },
      { kind: 'han', expect: '爸', py: '' },
    ],
  }
  const fb = extractSyllablesFromSentLine(fallback)
  assert(fb.syllables.length === 5, 'fallback sentence has syllables')
  assert(fb.syllables[0] === 'zhe', 'fallback 这 → zhe')
} else {
  console.log('  (skip cedict tests — dictionary not loaded)')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
