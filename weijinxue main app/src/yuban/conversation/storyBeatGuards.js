/**
 * Anti-repetition helpers for story beat generation.
 */

/** @typedef {{
 *   dialogueHanzi: string,
 *   productionPrompt: string,
 *   expectedPatternHint: string,
 *   evaluation?: string,
 * }} RecentProductionBeat
 */

const FALLBACK_BEATS_HSK1 = [
  {
    narration: 'The hotel clerk smiles as you approach the desk.',
    speaker: { id: 'clerk', chineseName: '服务员', pinyinName: 'Fúwùyuán', role: 'clerk', isNew: false },
    dialogue: { hanzi: '早上好！', pinyin: 'Zǎoshang hǎo!', english: 'Good morning!' },
    productionPrompt: 'Reply with a short greeting.',
    expectedPatternHint: 'Greeting — 你好 / 早上好 / 早',
    newVocab: [{ hanzi: '早上好', pinyin: 'zǎoshang hǎo', english: 'good morning' }],
    introducedNPC: null,
    storyLogEntry: 'Morning greeting at the hotel.',
  },
  {
    narration: 'You are thirsty after walking around.',
    speaker: { id: 'waiter', chineseName: '服务员', pinyinName: 'Fúwùyuán', role: 'waiter', isNew: false },
    dialogue: { hanzi: '你要喝什么？', pinyin: 'Nǐ yào hē shénme?', english: 'What do you want to drink?' },
    productionPrompt: 'Say what you want to drink (water or tea).',
    expectedPatternHint: '我要 + drink',
    newVocab: [{ hanzi: '水', pinyin: 'shuǐ', english: 'water' }],
    introducedNPC: null,
    storyLogEntry: 'Ordered a drink.',
  },
  {
    narration: 'You want to find your room.',
    speaker: { id: 'guide', chineseName: '小李', pinyinName: 'Xiǎo Lǐ', role: 'guide', isNew: false },
    dialogue: { hanzi: '你的房间在哪儿？', pinyin: 'Nǐ de fángjiān zài nǎr?', english: 'Where is your room?' },
    productionPrompt: 'Tell them you want to go to your room using 去.',
    expectedPatternHint: '我要去房间 / 我想去我的房间',
    newVocab: [{ hanzi: '房间', pinyin: 'fángjiān', english: 'room' }],
    introducedNPC: null,
    storyLogEntry: 'Asked about the room.',
  },
  {
    narration: 'At a small restaurant, the server points at the menu.',
    speaker: { id: 'server', chineseName: '服务员', pinyinName: 'Fúwùyuán', role: 'server', isNew: false },
    dialogue: { hanzi: '你要米饭吗？', pinyin: 'Nǐ yào mǐfàn ma?', english: 'Do you want rice?' },
    productionPrompt: 'Answer yes or no simply.',
    expectedPatternHint: '要 / 不要 / 是的',
    newVocab: [{ hanzi: '米饭', pinyin: 'mǐfàn', english: 'rice' }],
    introducedNPC: null,
    storyLogEntry: 'Answered about rice.',
  },
  {
    narration: 'Someone helps you with your bags.',
    speaker: { id: 'helper', chineseName: '路人', pinyinName: 'Lùrén', role: 'stranger', isNew: false },
    dialogue: { hanzi: '不客气！', pinyin: 'Bù kèqi!', english: "You're welcome!" },
    productionPrompt: 'Respond politely (thanks / you are welcome).',
    expectedPatternHint: '谢谢 / 不客气',
    newVocab: [{ hanzi: '谢谢', pinyin: 'xièxie', english: 'thank you' }],
    introducedNPC: null,
    storyLogEntry: 'Said thanks.',
  },
  {
    narration: 'You see a price tag on a bottle of water.',
    speaker: { id: 'shop', chineseName: '店员', pinyinName: 'Diànyuán', role: 'shop clerk', isNew: false },
    dialogue: { hanzi: '多少钱？', pinyin: 'Duōshao qián?', english: 'How much is it?' },
    productionPrompt: 'Ask how much it costs or answer briefly.',
    expectedPatternHint: '多少钱',
    newVocab: [{ hanzi: '钱', pinyin: 'qián', english: 'money' }],
    introducedNPC: null,
    storyLogEntry: 'Asked about price.',
  },
]

/**
 * @param {RecentProductionBeat[] | undefined} recent
 */
export function buildRecentBeatsPromptFragment(recent) {
  const list = (recent ?? []).slice(0, 5)
  if (!list.length) return ''

  const lines = list.map((b, i) => {
    const ok = b.evaluation === 'correct' ? ' (student succeeded)' : ''
    return `${i + 1}. NPC: "${b.dialogueHanzi}" | Task: ${b.productionPrompt} | Pattern: ${b.expectedPatternHint}${ok}`
  })

  return `

RECENT PRODUCTION GAPS — DO NOT REPEAT (last ${list.length} turns):
${lines.join('\n')}

ANTI-REPETITION RULES:
- Do NOT ask the same NPC question again (e.g. do not repeat 你要去哪里? if already practiced).
- Do NOT reuse the same target location/object (e.g. if student already went to 健身房, use 房间, 饭店, 学校, or a different task).
- Do NOT reuse the same expectedPatternHint twice in a row.
- If the student recently succeeded at 去 + 健身房, choose a DIFFERENT HSK 1 task: greeting, ordering water/tea/rice, price, thanks, yes/no, or 去 + room/restaurant.
- Pick a fresh combination: new grammar focus OR new vocabulary object.`
}

/**
 * @param {import('./turnTypes.js').StoryBeatTurn} beat
 * @param {RecentProductionBeat[] | undefined} recent
 * @returns {string | null} reason code or null if not duplicate
 */
export function getDuplicateBeatReason(beat, recent) {
  const list = recent ?? []
  if (!list.length) return null
  const hanzi = beat.dialogue?.hanzi ?? ''
  const hint = beat.expectedPatternHint ?? ''
  const prompt = beat.productionPrompt ?? ''

  for (const r of list.slice(0, 3)) {
    if (r.dialogueHanzi === hanzi && r.expectedPatternHint === hint) {
      return 'duplicate_question_and_hint'
    }
    if (r.dialogueHanzi === hanzi && r.productionPrompt === prompt) {
      return 'duplicate_question_and_prompt'
    }
    const gymRepeat =
      /健身房/.test(hanzi + prompt + hint) &&
      /健身房/.test((r.dialogueHanzi ?? '') + (r.productionPrompt ?? '') + (r.expectedPatternHint ?? ''))
    if (gymRepeat) return 'duplicate_gym'
    const whereRepeat =
      /去哪里|去哪儿|去哪里/.test(hanzi) &&
      /去哪里|去哪儿/.test(r.dialogueHanzi ?? '') &&
      r.evaluation === 'correct'
    if (whereRepeat) return 'duplicate_where_question'
  }
  return null
}

/**
 * @param {import('./turnTypes.js').StoryBeatTurn} beat
 * @param {RecentProductionBeat[] | undefined} recent
 */
export function isDuplicateBeat(beat, recent) {
  return Boolean(getDuplicateBeatReason(beat, recent))
}

/**
 * @param {number} hskLevel
 * @param {RecentProductionBeat[] | undefined} recent
 */
export function pickFallbackBeat(hskLevel, recent) {
  const used = new Set(
    (recent ?? []).flatMap((r) => [r.dialogueHanzi, r.expectedPatternHint].filter(Boolean)),
  )
  const pool = hskLevel <= 1 ? FALLBACK_BEATS_HSK1 : FALLBACK_BEATS_HSK1
  for (const beat of pool) {
    if (!used.has(beat.dialogue.hanzi)) {
      return { ...beat, introducedNPC: beat.introducedNPC ?? null }
    }
  }
  return { ...pool[0], introducedNPC: pool[0].introducedNPC ?? null }
}
