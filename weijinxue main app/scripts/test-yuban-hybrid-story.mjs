/**
 * Local story beat + hybrid mode tests.
 * Run: node scripts/test-yuban-hybrid-story.mjs
 */
import { pickLocalStoryBeat } from '../src/yuban/story/localStoryBeats.js'
import { shouldUseLocalStoryBeat } from '../src/yuban/config/yubanConfig.js'

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

const beat = pickLocalStoryBeat({ hskLevel: 1, recentProductionBeats: [] })
assert(beat?.dialogue?.hanzi, 'local story beat returns valid full shape')
assert(beat?.productionPrompt, 'local beat has productionPrompt')
assert(beat?.source === 'local_template', 'local beat source tag')

const recent = [{ dialogueHanzi: beat.dialogue.hanzi, productionPrompt: beat.productionPrompt, expectedPatternHint: '' }]
const beat2 = pickLocalStoryBeat({ hskLevel: 1, recentProductionBeats: recent })
assert(beat2?.dialogue?.hanzi !== beat.dialogue.hanzi, 'local story beat avoids recent duplicate when possible')

let localCount = 0
for (let i = 0; i < 9; i += 1) {
  if (shouldUseLocalStoryBeat(i, 'hybrid')) localCount += 1
}
assert(localCount === 6, 'hybrid mode uses local beat for 2 of every 3 turns')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
