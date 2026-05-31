import { classifyVocabMastery } from '../helpers/vocabHelpers.js'
import { buildWeaknessProfile } from '../curriculum/weaknessProfile.js'
import { buildRecentBeatsPromptFragment } from './storyBeatGuards.js'

/**
 * @param {import('../StoryStateContext.jsx').YubanStoryState | null} state
 */
export function buildStoryBeatPrompt(state) {
  const s = state ?? {}
  const classified = classifyVocabMastery(s)

  const warmVocab =
    Object.entries(classified)
      .filter(([, v]) => v.mastery === 'warm')
      .slice(0, 8)
      .map(([hanzi, v]) => `${hanzi} (${v.pinyin}) = ${v.english}`)
      .join(', ') || 'none yet'

  const coldVocab =
    Object.entries(classified)
      .filter(([, v]) => v.mastery === 'cold')
      .slice(0, 5)
      .map(([hanzi, v]) => `${hanzi} (${v.pinyin})`)
      .join(', ') || 'none yet'

  const scenario = s.currentScenario ?? 'arrival'
  const npcEntries = Object.values(s.npcs ?? {})
  const scenarioNpcs = npcEntries.filter(
    (n) => !n.scenario || n.scenario === scenario || scenario === 'arrival',
  )
  const npcList =
    (scenarioNpcs.length ? scenarioNpcs : npcEntries)
      .slice(0, 8)
      .map((n) => `${n.chineseName} (${n.pinyinName}, ${n.role})`)
      .join(', ') || 'none yet'

  const recentEvents =
    (s.storyLog ?? [])
      .slice(0, 3)
      .map((e) => `- ${e.summary}`)
      .join('\n') || '- (story just beginning)'

  const hskLevel = Number(s.hskLevel ?? 1)

  const base = `You are Yǔbàn, a Chinese language coach embedded in a story.

THE STUDENT:
- Chinese name: ${s.chineseName ?? ''} (${s.pinyinName ?? ''})
- City: ${s.city ?? ''}
- HSK level: ${hskLevel}
- Day in China: ${s.daysInChina ?? 0}
- Current scenario: ${s.currentScenario ?? 'arrival'}
- Sessions completed: ${s.sessionsCompleted ?? 0}

PEOPLE THEY'VE MET: ${npcList}

RECENT EVENTS:
${recentEvents}

WARM VOCABULARY (recently seen): ${warmVocab}
COLD VOCABULARY (try to recycle into this turn if natural): ${coldVocab}

YOUR JOB:
Generate ONE small story beat that:
1. Continues their life in China naturally
2. Has exactly ONE NPC speak ONE Chinese line at HSK ${hskLevel} level
3. Asks the student to respond (this is the Production Gap)
4. May introduce a new NPC or reuse a known one
5. May introduce 1-3 new vocabulary words but no more
6. Prefers HSK ${hskLevel} grammar; never uses grammar above level

RULES:
- The NPC line should be SHORT — typically 4-12 characters at HSK 1
- Pick ONE clear thing the student should respond with — no compound prompts
- If reusing a known NPC, stay in character with their established role
- If introducing a new NPC, fill in the introducedNPC field
- Use the student's Chinese name when the NPC addresses them

OUTPUT FORMAT — return ONLY valid JSON, no markdown fences, no commentary:
{
  "narration": "Short English setup, 1-2 sentences. Describe the scene.",
  "speaker": {
    "id": "stable_lowercase_id",
    "chineseName": "小李",
    "pinyinName": "Xiǎo Lǐ",
    "role": "coworker",
    "isNew": false
  },
  "dialogue": {
    "hanzi": "你好！",
    "pinyin": "Nǐ hǎo!",
    "english": "Hello!"
  },
  "productionPrompt": "How do you greet 小李 back?",
  "expectedPatternHint": "Reply with a greeting",
  "newVocab": [
    { "hanzi": "你好", "pinyin": "nǐ hǎo", "english": "hello" }
  ],
  "introducedNPC": null,
  "storyLogEntry": "Met 小李 at the office for the first time."
}

If you introduce a new NPC, set "introducedNPC" to the same shape as "speaker" (must include id, chineseName, pinyinName, role).
Set "introducedNPC" to null if reusing a known NPC.`

  const profile = buildWeaknessProfile(s)
  const antiRepeat = buildRecentBeatsPromptFragment(s.recentProductionBeats)
  if (import.meta.env.DEV && profile) {
    console.debug('[Yǔbàn] Adaptive teaching profile:', profile.trim())
  }
  return base + profile + antiRepeat
}

export { buildThreeVoicesGradingPrompt as buildThreeVoicesPrompt } from './buildGradingPrompt.js'
