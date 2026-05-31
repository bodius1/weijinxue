/**
 * Deterministic grading adjustments — forgiving, task-aware rules layered on AI output.
 */

const GREETING_REPLIES = new Set([
  '早',
  '你好',
  '您好',
  '嗨',
  '早上好',
  '你好吗',
  '谢谢',
])

const YES_AFFIRMATIVE = new Set([
  '是',
  '是的',
  '对',
  '要',
  '要的',
  '吃',
  '喝',
  '我要',
  '我要吃',
  '我要吃饭',
  '我要喝水',
  '我饿了',
  '饿了',
  '好的',
  '好',
])

const YES_NEGATIVE = new Set(['不', '不要', '不吃', '不喝', '我不要', '我不吃', '我不喝', '不是'])


/**
 * @param {string} s
 */
function normReply(s) {
  return String(s ?? '')
    .trim()
    .replace(/[！!？?。，,\s]+$/g, '')
}

/**
 * @param {import('./turnTypes.js').StoryBeatTurn} turn
 */
function isGreetingTurn(turn) {
  const blob = `${turn.dialogue?.hanzi ?? ''} ${turn.productionPrompt ?? ''} ${turn.expectedPatternHint ?? ''}`
  return /早上好|你好|欢迎|greeting|问候|打招呼/i.test(blob)
}

/**
 * @param {import('./turnTypes.js').StoryBeatTurn} turn
 */
function isYesNoTurn(turn) {
  const npc = turn.dialogue?.hanzi ?? ''
  const blob = `${npc} ${turn.productionPrompt ?? ''} ${turn.expectedPatternHint ?? ''}`
  return (
    /[吗嗎]\s*$/.test(npc) ||
    /吃饭吗|喝水吗|要.*吗|yes.*no|要.*不要/i.test(blob) ||
    /Reply with.*要|要.*不要/i.test(turn.expectedPatternHint ?? '')
  )
}

/**
 * @param {import('./turnTypes.js').StoryBeatTurn} turn
 */
function isLocationTurn(turn) {
  const npc = turn.dialogue?.hanzi ?? ''
  const prompt = turn.productionPrompt ?? ''
  const hint = turn.expectedPatternHint ?? ''
  const blob = `${npc} ${prompt} ${hint}`
  return (
    /去哪里|去哪儿|去哪|哪儿|哪里/.test(npc) ||
    /去.*(房间|饭店|学校|健身房|地方|location)/i.test(blob) ||
    /location|房间|健身房|饭店/.test(prompt + hint)
  )
}

/**
 * @param {import('./turnTypes.js').StoryBeatTurn} turn
 */
function isDrinkTurn(turn) {
  const blob = `${turn.dialogue?.hanzi ?? ''} ${turn.productionPrompt ?? ''}`
  return /喝水|喝.*水|drink water/i.test(blob)
}

/**
 * @param {import('./turnTypes.js').StoryBeatTurn} turn
 */
function isEatTurn(turn) {
  const blob = `${turn.dialogue?.hanzi ?? ''} ${turn.productionPrompt ?? ''}`
  return /吃饭|吃吗|eat/i.test(blob)
}

/**
 * @param {string} reply
 */
function hasGoAndDestination(reply) {
  if (!/去/.test(reply)) return false
  return /房间|饭店|学校|健身房|我的|那儿|那里|这儿|这里/.test(reply) || reply.length >= 4
}

/**
 * @param {string} text
 */
function isMostlyChinese(text) {
  const t = String(text ?? '').trim()
  if (!t) return false
  const han = (t.match(/[\u4e00-\u9fff]/g) ?? []).length
  return han / t.length > 0.3
}

/**
 * @param {import('./turnTypes.js').ThreeVoicesResponse} normalized
 * @param {{ teacherNote?: string, friendNote?: string, lurenNote?: string }} [notes]
 */
function upgradeToCorrect(normalized, notes = {}) {
  const teacher = { ...normalized.voices.laoshi }
  if (notes.teacherNote) teacher.note = notes.teacherNote
  const pengyou = { ...normalized.voices.pengyou }
  if (notes.friendNote) {
    pengyou.note = notes.friendNote
    pengyou.friendLabel = 'natural'
  }
  const luren = { ...normalized.voices.luren }
  if (notes.lurenNote) luren.note = notes.lurenNote

  return {
    ...normalized,
    verdict: 'correct',
    evaluation: 'correct',
    taskCompleted: true,
    naturalness: normalized.naturalness || 'casual_correct',
    likelyTypo: false,
    allowRecoveryButton: false,
    mistakeRecord: null,
    encouragement: 'Nice — you completed the task.',
    voices: { laoshi: teacher, pengyou, luren },
  }
}

/**
 * @param {import('./turnTypes.js').ThreeVoicesResponse} normalized
 * @param {{ teacherNote?: string, hanzi?: string, pinyin?: string, english?: string, likelyTypo?: boolean, studentWrote?: string, likelyIntended?: string, allowRecovery?: boolean }} patch
 */
function patchAlmost(normalized, patch) {
  const teacher = { ...normalized.voices.laoshi, note: patch.teacherNote ?? normalized.voices.laoshi.note }
  if (patch.hanzi) teacher.hanzi = patch.hanzi
  if (patch.pinyin) teacher.pinyin = patch.pinyin
  if (patch.english) teacher.english = patch.english

  return {
    ...normalized,
    verdict: 'almost',
    evaluation: 'almost',
    likelyTypo: patch.likelyTypo ?? normalized.likelyTypo,
    studentWrote: patch.studentWrote ?? normalized.studentWrote,
    likelyIntended: patch.likelyIntended ?? normalized.likelyIntended,
    allowRecoveryButton: patch.allowRecovery ?? normalized.allowRecoveryButton,
    voices: { ...normalized.voices, laoshi: teacher },
    encouragement: 'Almost — here is how to sharpen it.',
  }
}

/**
 * Strip misleading "above level" labels for short HSK-1-style friend lines.
 * @param {import('./turnTypes.js').ThreeVoicesResponse} normalized
 */
function sanitizeFriendLabel(normalized) {
  const pengyou = normalized.voices.pengyou
  if (!pengyou?.hanzi || pengyou.friendLabel !== 'above_current_level') return normalized
  const hanzi = pengyou.hanzi.replace(/[^\u4e00-\u9fff]/g, '')
  if (hanzi.length <= 8) {
    return {
      ...normalized,
      voices: {
        ...normalized.voices,
        pengyou: {
          ...pengyou,
          friendLabel: 'natural',
          note: pengyou.note?.includes('Above')
            ? 'What a peer your age would actually say.'
            : pengyou.note,
        },
      },
    }
  }
  return normalized
}

/**
 * Force English explanations for HSK 1–2 when AI returned Chinese prose.
 * @param {import('./turnTypes.js').ThreeVoicesResponse} normalized
 * @param {number} hskLevel
 */
function enforceEnglishNotes(normalized, hskLevel) {
  if (hskLevel > 2) return normalized
  const laoshi = { ...normalized.voices.laoshi }
  const pengyou = { ...normalized.voices.pengyou }
  const luren = { ...normalized.voices.luren }

  if (laoshi.note && isMostlyChinese(laoshi.note) && hskLevel <= 1) {
    laoshi.note =
      'Your reply works in conversation. See the Chinese model line above for a natural phrasing.'
  }
  if (pengyou.note && isMostlyChinese(pengyou.note)) {
    pengyou.note = 'Casual register — how a friend might say it.'
  }
  if (luren.note && isMostlyChinese(luren.note)) {
    luren.note = 'In everyday speech, short answers are very common in Mandarin.'
  }

  return { ...normalized, voices: { laoshi, pengyou, luren } }
}

/**
 * @param {import('./turnTypes.js').StoryBeatTurn} turn
 * @param {string} studentReply
 * @param {import('./turnTypes.js').ThreeVoicesResponse} normalized
 * @param {import('../StoryStateContext.jsx').YubanStoryState | null} [state]
 */
export function applyGradingOverrides(turn, studentReply, normalized, state = null) {
  if (!turn || studentReply === '(skipped)') return normalized

  const hskLevel = Number(state?.hskLevel ?? 1)
  let result = sanitizeFriendLabel(normalized)
  const reply = normReply(studentReply)
  if (!reply) return enforceEnglishNotes(result, hskLevel)

  if (isGreetingTurn(turn) && GREETING_REPLIES.has(reply)) {
    const note =
      reply === '你好吗'
        ? 'Good! “你好吗？” can also respond to a greeting (like “How are you?”). A simpler reply is 你好.'
        : reply === '早'
          ? 'Good! “早” is a natural short reply. The full form is 早上好.'
          : `Good! “${reply}” is a natural greeting here.`
    result = upgradeToCorrect(result, {
      teacherNote: note,
      friendNote: reply === '你好吗' ? '你好啊！' : 'Casual and natural.',
      lurenNote:
        reply === '你好吗'
          ? '“你好吗？” is a greeting question — not wrong as a reply to 你好.'
          : result.voices.luren.note,
    })
  }

  if (isYesNoTurn(turn)) {
    if (YES_AFFIRMATIVE.has(reply) || /^是的/.test(reply) || /^对/.test(reply)) {
      const wantsYao = /要|不要/.test(turn.expectedPatternHint ?? '')
      const usedYao = /^要/.test(reply) || reply === '要'
      const teacherNote = wantsYao && !usedYao
        ? 'Correct! “是的” answers the question. This task is practicing 要 (yào) — also try: 要 or 我要.'
        : reply === '我饿了' || reply === '饿了'
          ? 'Correct! “我饿了” is a natural way to say you want to eat.'
          : 'Correct! That works as a yes/no answer here.'
      result = upgradeToCorrect(result, {
        teacherNote,
        friendNote: isEatTurn(turn) ? '要！/ 我要吃饭。' : 'Natural short answer.',
        lurenNote:
          reply === '是的'
            ? 'For yes/no questions, 是的 is understandable; 要 is more direct when offering food.'
            : result.voices.luren.note,
      })
    }
    if (YES_NEGATIVE.has(reply)) {
      result = upgradeToCorrect(result, {
        teacherNote: 'Correct — a clear “no” answer.',
      })
    }
  }

  if (isLocationTurn(turn) && hasGoAndDestination(reply)) {
    result = upgradeToCorrect(result, {
      teacherNote: /想/.test(reply)
        ? 'Good! You can also say: 我要去我的房间.'
        : 'Good! You said clearly where you want to go.',
    })
  }

  if (isDrinkTurn(turn) && /和/.test(reply) && /我要/.test(reply) && !/喝/.test(reply)) {
    result = patchAlmost(result, {
      teacherNote:
        'Almost — you likely meant 喝 (hē, “drink”), not 和 (hé, “and”). Primary fix: 我要喝水. Simpler: 我要水.',
      hanzi: '我要喝水。',
      pinyin: 'Wǒ yào hē shuǐ.',
      english: 'I want to drink water.',
      likelyTypo: true,
      studentWrote: '和',
      likelyIntended: '喝',
      allowRecovery: true,
    })
  }

  if (/俄/.test(reply) && /饿|了/.test(reply.replace(/俄/g, '饿'))) {
    const fixed = reply.replace(/俄/g, '饿')
    const isAffirmative = /^是的/.test(fixed) || YES_AFFIRMATIVE.has(fixed)
    if (isAffirmative || /饿了/.test(fixed)) {
      result = upgradeToCorrect(result, {
        teacherNote: `Good! Watch the character 饿 (è, hungry) — not 俄 (é, Russia). Model: ${fixed}`,
        lurenNote: 'Typo picked the wrong character with similar shape.',
      })
    }
  }

  return enforceEnglishNotes(result, hskLevel)
}
