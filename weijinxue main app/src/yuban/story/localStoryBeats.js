import { getDuplicateBeatReason } from '../conversation/storyBeatGuards.js'

/** @typedef {import('../conversation/storyBeatGuards.js').RecentProductionBeat} RecentProductionBeat */

const HSK1_BEATS = [
  {
    category: 'greeting',
    narration: 'Someone greets you with a smile.',
    speaker: { id: 'friend', chineseName: '小王', pinyinName: 'Xiǎo Wáng', role: 'friend', isNew: false },
    dialogue: { hanzi: '你好！', pinyin: 'Nǐ hǎo!', english: 'Hello!' },
    productionPrompt: 'Reply with a greeting.',
    expectedPatternHint: '你好 / 你好吗 / 早',
    newVocab: [{ hanzi: '你好', pinyin: 'nǐ hǎo', english: 'hello' }],
    storyLogEntry: 'Greeted 小王.',
  },
  {
    category: 'greeting',
    narration: 'Morning at the hotel lobby.',
    speaker: { id: 'clerk', chineseName: '服务员', pinyinName: 'Fúwùyuán', role: 'clerk', isNew: false },
    dialogue: { hanzi: '早上好！', pinyin: 'Zǎoshang hǎo!', english: 'Good morning!' },
    productionPrompt: 'Reply with a short greeting.',
    expectedPatternHint: '早上好 / 早',
    newVocab: [{ hanzi: '早上好', pinyin: 'zǎoshang hǎo', english: 'good morning' }],
    storyLogEntry: 'Morning greeting.',
  },
  {
    category: 'yes_no',
    narration: 'You look thirsty after walking.',
    speaker: { id: 'waiter', chineseName: '服务员', pinyinName: 'Fúwùyuán', role: 'waiter', isNew: false },
    dialogue: { hanzi: '要喝水吗？', pinyin: 'Yào hē shuǐ ma?', english: 'Do you want to drink water?' },
    productionPrompt: 'Answer yes or no (or say what you want).',
    expectedPatternHint: '要 / 不要 / 我要喝水',
    newVocab: [{ hanzi: '水', pinyin: 'shuǐ', english: 'water' }],
    storyLogEntry: 'Offered water.',
  },
  {
    category: 'yes_no',
    narration: 'Tea smells good at the café.',
    speaker: { id: 'server', chineseName: '服务员', pinyinName: 'Fúwùyuán', role: 'server', isNew: false },
    dialogue: { hanzi: '要喝茶吗？', pinyin: 'Yào hē chá ma?', english: 'Would you like tea?' },
    productionPrompt: 'Answer yes or no simply.',
    expectedPatternHint: '要 / 不要',
    newVocab: [{ hanzi: '茶', pinyin: 'chá', english: 'tea' }],
    storyLogEntry: 'Tea offer.',
  },
  {
    category: 'yes_no',
    narration: 'Lunch time at the canteen.',
    speaker: { id: 'cook', chineseName: '厨师', pinyinName: 'Chúshī', role: 'cook', isNew: false },
    dialogue: { hanzi: '你要吃饭吗？', pinyin: 'Nǐ yào chī fàn ma?', english: 'Do you want to eat?' },
    productionPrompt: 'Answer yes or no.',
    expectedPatternHint: '要 / 不要 / 我饿了',
    newVocab: [{ hanzi: '饭', pinyin: 'fàn', english: 'meal / rice' }],
    storyLogEntry: 'Asked about eating.',
  },
  {
    category: 'yes_no',
    narration: 'The server points at rice.',
    speaker: { id: 'server2', chineseName: '服务员', pinyinName: 'Fúwùyuán', role: 'server', isNew: false },
    dialogue: { hanzi: '你要米饭吗？', pinyin: 'Nǐ yào mǐfàn ma?', english: 'Do you want rice?' },
    productionPrompt: 'Answer yes or no.',
    expectedPatternHint: '要 / 不要',
    newVocab: [{ hanzi: '米饭', pinyin: 'mǐfàn', english: 'rice' }],
    storyLogEntry: 'Rice offer.',
  },
  {
    category: 'location',
    narration: 'Your guide checks on your plans.',
    speaker: { id: 'guide', chineseName: '李姐', pinyinName: 'Lǐ Jiě', role: 'guide', isNew: false },
    dialogue: { hanzi: '你要去哪里？', pinyin: 'Nǐ yào qù nǎlǐ?', english: 'Where do you want to go?' },
    productionPrompt: 'Tell them where you want to go using 去.',
    expectedPatternHint: '我要去房间 / 我想去…',
    newVocab: [{ hanzi: '哪里', pinyin: 'nǎlǐ', english: 'where' }],
    storyLogEntry: 'Asked about destination.',
  },
  {
    category: 'location',
    narration: 'You need to find a place.',
    speaker: { id: 'guide2', chineseName: '路人', pinyinName: 'Lùrén', role: 'stranger', isNew: false },
    dialogue: { hanzi: '你去哪儿？', pinyin: 'Nǐ qù nǎr?', english: 'Where are you going?' },
    productionPrompt: 'Say where you are going.',
    expectedPatternHint: '去 + place',
    newVocab: [],
    storyLogEntry: 'Asked where you go.',
  },
  {
    category: 'ordering',
    narration: 'Menu time at a small restaurant.',
    speaker: { id: 'chef', chineseName: '服务员', pinyinName: 'Fúwùyuán', role: 'server', isNew: false },
    dialogue: { hanzi: '你要吃什么？', pinyin: 'Nǐ yào chī shénme?', english: 'What do you want to eat?' },
    productionPrompt: 'Say what you want to eat.',
    expectedPatternHint: '我要吃… / 我想吃…',
    newVocab: [{ hanzi: '吃', pinyin: 'chī', english: 'to eat' }],
    storyLogEntry: 'Asked what to eat.',
  },
  {
    category: 'thanks',
    narration: 'Someone helps you.',
    speaker: { id: 'helper', chineseName: '朋友', pinyinName: 'Péngyǒu', role: 'friend', isNew: false },
    dialogue: { hanzi: '谢谢！', pinyin: 'Xièxie!', english: 'Thank you!' },
    productionPrompt: 'Respond politely.',
    expectedPatternHint: '不客气 / 谢谢',
    newVocab: [{ hanzi: '谢谢', pinyin: 'xièxie', english: 'thank you' }],
    storyLogEntry: 'Said thanks.',
  },
]

/**
 * @param {{
 *   hskLevel?: number,
 *   scenario?: string,
 *   recentProductionBeats?: RecentProductionBeat[],
 *   warmVocab?: string[],
 *   targetSkill?: string,
 * }} opts
 */
export function pickLocalStoryBeat(opts = {}) {
  const hsk = Number(opts.hskLevel ?? 1)
  if (hsk > 1) return null

  const recent = opts.recentProductionBeats ?? []
  const usedHanzi = new Set(recent.flatMap((r) => [r.dialogueHanzi, r.expectedPatternHint].filter(Boolean)))

  const pool = [...HSK1_BEATS]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  for (const beat of pool) {
    if (usedHanzi.has(beat.dialogue.hanzi)) continue
    const candidate = {
      ...beat,
      introducedNPC: null,
      source: 'local_template',
    }
    if (!getDuplicateBeatReason(candidate, recent)) {
      return candidate
    }
  }

  for (const beat of HSK1_BEATS) {
    const candidate = { ...beat, introducedNPC: null, source: 'local_template' }
    if (!getDuplicateBeatReason(candidate, recent)) return candidate
  }

  return { ...HSK1_BEATS[0], introducedNPC: null, source: 'local_template' }
}
