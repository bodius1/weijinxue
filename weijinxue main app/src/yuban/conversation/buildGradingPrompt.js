import { classifyVocabMastery } from '../helpers/vocabHelpers.js'
import { buildWeaknessProfile } from '../curriculum/weaknessProfile.js'

/**
 * Learner context block for the grader.
 * @param {import('../StoryStateContext.jsx').YubanStoryState | null} state
 */
export function buildLearnerContextForGrading(state) {
  const s = state ?? {}
  const hskLevel = Number(s.hskLevel ?? 1)
  const classified = classifyVocabMastery(s)

  const masteredPatterns = Object.values(s.patternMastery ?? {})
    .filter((p) => p.status === 'mastered')
    .slice(0, 8)
    .map((p) => p.label || p.patternId)
    .join(', ')

  const practicingPatterns = Object.values(s.patternMastery ?? {})
    .filter((p) => p.status === 'practicing' || p.status === 'almost')
    .slice(0, 6)
    .map((p) => p.label || p.patternId)
    .join(', ')

  const warmVocab = Object.entries(classified)
    .filter(([, v]) => v.mastery === 'warm' || v.mastery === 'mastered')
    .slice(0, 12)
    .map(([hanzi]) => hanzi)
    .join(', ')

  const recentMistakes = (s.mistakeLog ?? [])
    .slice(-5)
    .map((m) => `${m.type}${m.wrote ? `: wrote "${m.wrote}"` : ''}`)
    .join('; ')

  return `LEARNER PROFILE:
- HSK level: ${hskLevel} (老师 explanations in English for HSK 1–2)
- Script: simplified Chinese
- Input mode: pinyin IME → hanzi (expect typos / wrong character picks)
- Mastered patterns: ${masteredPatterns || 'none yet'}
- Practicing patterns: ${practicingPatterns || 'none yet'}
- Familiar vocabulary: ${warmVocab || 'none yet'}
- Recent mistakes: ${recentMistakes || 'none'}`
}

/**
 * @param {import('../StoryStateContext.jsx').YubanStoryState | null} state
 * @param {import('./turnTypes.js').StoryBeatTurn} turn
 * @param {string} studentReply
 * @param {{ recoveryNote?: string }} [opts]
 */
/**
 * Compact LLM grading prompt (~2–3K chars target).
 */
export function buildThreeVoicesGradingPromptCompact(state, turn, studentReply, opts = {}) {
  const hskLevel = Number(state?.hskLevel ?? 1)
  const recoveryNote = opts.recoveryNote ? `\n${opts.recoveryNote}\n` : ''
  const mistakes =
    (state?.mistakeLog ?? [])
      .slice(-3)
      .map((m) => `${m.type}${m.wrote ? `: ${m.wrote}` : ''}`)
      .join('; ') || 'none'
  const lastEvent = (state?.storyLog ?? [])[0]?.summary ?? ''

  return `Grade HSK ${hskLevel} Mandarin story reply. Communicative task completion > exact hint match.

NPC: "${turn.dialogue.hanzi}" (${turn.dialogue.pinyin}) — "${turn.dialogue.english}"
Task: "${turn.productionPrompt}"
Hint (guide only): ${turn.expectedPatternHint ?? 'appropriate reply'}
Student: "${studentReply}"
${recoveryNote}
Last story beat: ${lastEvent || 'n/a'}
Recent mistakes (top 3): ${mistakes}

Rules:
- If reply works in real conversation → usually "correct".
- Different valid pattern than hint → still "correct" + English nudge to try hint pattern.
- 老师 explanation: English only (HSK1), Chinese in hanzi/pinyin fields only.
- 朋友/路人 notes: English only. Do not mark all-HSK${hskLevel} sentences "above_current_level".
- Typos: 和→喝 when drinking context; 俄→饿 for hungry; 堆→对 when affirming (e.g. 吃饭吗?).
- alternatives[] MUST include hanzi, pinyin, english for each item (no empty objects).

Return ONLY JSON:
{"verdict":"correct|almost|incorrect|off_task","taskType":"greeting|yes_no_response|choice_response|short_answer|ordering_food|asking_location|open_conversation","taskCompleted":true,"detectedIntent":"affirmative|negative|greeting|unknown","likelyTypo":false,"studentWrote":"","likelyIntended":"","allowRecoveryButton":false,"recoveryButtonText":"","voices":{"teacher":{"hanzi":"","pinyin":"","english":"","explanation":""},"friend":{"hanzi":"","pinyin":"","english":"","label":"natural"},"bystander":{"tip":""}},"alternatives":[{"hanzi":"","pinyin":"","english":"","note":""}],"mistakeLog":{"shouldLog":false,"type":"none"}}`
}

export function buildThreeVoicesGradingPrompt(state, turn, studentReply, opts = {}) {
  if (opts.useCompact !== false) {
    return buildThreeVoicesGradingPromptCompact(state, turn, studentReply, opts)
  }

  const hskLevel = Number(state?.hskLevel ?? 1)
  const learnerBlock = buildLearnerContextForGrading(state)
  const weakness = buildWeaknessProfile(state)
  const recoveryNote = opts.recoveryNote ? `\n${opts.recoveryNote}\n` : ''

  return `You are grading a beginner Mandarin learner in an interactive story (Yǔbàn AI / WEIJINXUE).
Your job is NOT to require exact phrasing or match a hidden answer key.
Your job is to decide whether the learner completed the communicative task.

${learnerBlock}
${weakness}

SCENE:
- NPC line: "${turn.dialogue.hanzi}" (${turn.dialogue.pinyin}) — "${turn.dialogue.english}"
- Practice goal shown to student: "${turn.productionPrompt}"
- Pattern hint (weak guide only, NOT an answer key): ${turn.expectedPatternHint ?? 'appropriate reply'}
${recoveryNote}
STUDENT WROTE: "${studentReply}"

The reply may be hanzi, pinyin, English, or mixed.

GRADING RULES (apply in order):

1. COMMUNICATIVE CORRECTNESS first.
   Ask: "Would this reply work in real conversation?"
   If yes, the base evaluation is "correct."

2. TASK COMPLETION second.
   Ask: "Did the student use the specific target pattern the task asked for?"
   - Communicatively correct AND used target pattern → "correct"
   - Communicatively correct but DIFFERENT valid pattern → "correct" with pattern nudge in 老师 note (English)
   - Communicatively almost correct (minor error, clear intent) → "almost"
   - Communicatively wrong → "wrong" / "incorrect"

3. NEVER grade "almost" or "wrong" when the reply is naturally valid Chinese,
   even if it does not match the expected pattern hint.

EXAMPLES:
  Task: "Reply with a greeting" / NPC: 你好！
  Student: 你好吗 → CORRECT (valid greeting)
  Student: 嗨 → CORRECT
  Student: 谢谢 → ALMOST if not a greeting context
  Student: 再见 → WRONG (goodbye)

  Task: "Reply with 要 or 不" / NPC: 你要吃饭吗？
  Student: 是的 → CORRECT, note: "Also try: 要"
  Student: 对 → CORRECT
  Student: 要 → CORRECT
  Student: 我饿了 → CORRECT

VOICE LANGUAGE RULES:
- 老师 hanzi/pinyin: Chinese only
- 老师 explanation (note): HSK 1 → English ONLY (no Chinese prose in explanation)
  HSK 2 → English, short Chinese in parentheses OK
  HSK 3+ → may mix
- 朋友 note: English only
- 路人 tip: English only; Chinese only as inline examples in parentheses

朋友 LEVEL LABELING:
- Only use label "above_current_level" if vocabulary/grammar truly exceeds HSK ${hskLevel}
- Do NOT label 我要吃饭 or other all-HSK-${hskLevel} sentences as above level
- At-level friend note: describe register ("Casual — what a friend would say")

PATTERN NUDGE (correct but off-target hint):
- verdict stays "correct"
- 老师 note (English): "Correct! This task is practicing [pattern]. Also try: [example]."
- NEVER phrase as a correction

TYPO RULES:
- 我要和水 when NPC mentions 喝水 → likely 和→喝; primary model 我要喝水; alt 我要水
- 我俄了 → 饿 typo; prefer 我饿了; do not strip to 是的 only

ALWAYS follow this order:
1. Infer taskType from NPC line + practice goal.
2. Infer detectedIntent.
3. Decide taskCompleted separately from naturalness.
4. Check valid short reply, typos, IME wrong character.
5. 路人: ONE practical English sentence.

TASK RULES (examples):
- yes_no_response (e.g. 吃饭吗?): 吃, 不吃, 是的, 对, 我饿了, 等一下 — can be correct/almost; do NOT require full sentences.
- greeting (e.g. 早上好！ / 欢迎光临): 早, 你好, 您好, 嗨, 早上好, 谢谢 (if welcoming) — ALL correct; do NOT mark 早 as almost for being “incomplete.” Teacher may mention 早上好 as optional enrichment only.
- choice_response (e.g. 茶还是水): 茶, 水, 我想喝茶 — correct.
- asking_location / short_answer with 去: 我想去我的房间, 我要去房间, 去健身房 — correct when task is “say where you want to go.” 想 vs 要 both express intent — NEVER downgrade to almost for using 想 instead of 要. Teacher may suggest 我要去… as an alternative without changing verdict.
- Separate “different from hint” from “incorrect.” Valid synonyms / alternate beginner structures = correct.
- Structurally broken replies (e.g. 吃饭米饭 for 我想吃米饭) → almost with specific correction, not incorrect.
- Do NOT use a hardcoded acceptance list as main logic — but follow the rules above strictly.

TYPO / RECOVERY (e.g. student wrote 堆 for 吃饭吗? when 对 was intended):
- likelyTypo: true, likelyIntended: "对", allowRecoveryButton: true, recoveryButtonText: "I meant 对"
- verdict: "almost", taskCompleted: false until recovery
- 老师 explains: 堆 vs 对, then simple model answer at HSK level

OFF-TASK:
- verdict: "off_task" if understandable but wrong task (e.g. food question when only greeting needed)
- Do NOT rewrite their whole sentence into advanced Mandarin; state what the task needed, give ONE simple model.

OUTPUT — return ONLY valid JSON (no markdown):
{
  "verdict": "correct | almost | incorrect | off_task",
  "taskType": "greeting | yes_no_response | choice_response | short_answer | question_answer | ordering_food | asking_location | asking_price | correction_practice | open_conversation",
  "taskCompleted": true,
  "naturalness": "simple_correct | casual_correct | unnatural_but_understandable | off_task | unclear",
  "detectedIntent": "affirmative | negative | maybe | greeting | thanks | food_request | location_request | unknown",
  "likelyTypo": false,
  "studentWrote": "",
  "likelyIntended": "",
  "allowRecoveryButton": false,
  "recoveryButtonText": "",
  "voices": {
    "teacher": {
      "hanzi": "",
      "pinyin": "",
      "english": "",
      "explanation": ""
    },
    "friend": {
      "hanzi": "",
      "pinyin": "",
      "english": "",
      "label": "casual | natural | above_current_level"
    },
    "bystander": {
      "tip": ""
    }
  },
  "alternatives": [
    { "hanzi": "", "pinyin": "", "english": "", "note": "simplest" }
  ],
  "mistakeLog": {
    "shouldLog": false,
    "type": "typo | character_selection | word_order | off_task | too_advanced | wrong_intent | none",
    "details": ""
  }
}

If student skipped, not applicable here.
For correct answers: mistakeLog.shouldLog = false.
For typos: mistakeLog.type = "character_selection", shouldLog = true.`
}
