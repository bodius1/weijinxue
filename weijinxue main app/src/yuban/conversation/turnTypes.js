/**
 * @typedef {object} StorySpeaker
 * @property {string} id
 * @property {string} chineseName
 * @property {string} pinyinName
 * @property {string} role
 * @property {boolean} [isNew]
 */

/**
 * @typedef {object} StoryDialogue
 * @property {string} hanzi
 * @property {string} pinyin
 * @property {string} english
 */

/**
 * @typedef {object} VocabWord
 * @property {string} hanzi
 * @property {string} pinyin
 * @property {string} english
 */

/**
 * @typedef {object} StoryBeatTurn
 * @property {string} narration
 * @property {StorySpeaker} speaker
 * @property {StoryDialogue} dialogue
 * @property {string} productionPrompt
 * @property {string} [expectedPatternHint]
 * @property {VocabWord[]} [newVocab]
 * @property {StorySpeaker | null} [introducedNPC]
 * @property {string} [storyLogEntry]
 */

/**
 * @typedef {object} VoiceCard
 * @property {string} label
 * @property {string} [hanzi]
 * @property {string} [pinyin]
 * @property {string} [english]
 * @property {string} [note]
 * @property {string} [friendLabel]
 */

/**
 * @typedef {object} GradingAlternative
 * @property {string} hanzi
 * @property {string} pinyin
 * @property {string} english
 * @property {string} [note]
 */

/**
 * @typedef {object} ThreeVoicesResponse
 * @property {'correct' | 'almost' | 'wrong' | 'off_task' | 'skipped'} evaluation
 * @property {'correct' | 'almost' | 'incorrect' | 'off_task'} [verdict]
 * @property {string} [taskType]
 * @property {boolean} [taskCompleted]
 * @property {string} [naturalness]
 * @property {string} [detectedIntent]
 * @property {boolean} [likelyTypo]
 * @property {string} [studentWrote]
 * @property {string} [likelyIntended]
 * @property {boolean} [allowRecoveryButton]
 * @property {string} [recoveryButtonText]
 * @property {GradingAlternative[]} [alternatives]
 * @property {string} [studentReplyAsHanzi]
 * @property {{ laoshi: VoiceCard, pengyou: VoiceCard, luren: VoiceCard }} voices
 * @property {object | null} [mistakeRecord]
 * @property {string} [encouragement]
 * @property {string} [studentReply]
 * @property {string} [confidence]
 * @property {boolean} [recoveryApplied]
 */

/** @typedef {'idle' | 'loading_beat' | 'awaiting_student' | 'awaiting_confidence' | 'loading_voices' | 'showing_voices' | 'loading_tea_break' | 'showing_tea_break'} TurnPhase */

export const TURN_PHASES = /** @type {const} */ ([
  'idle',
  'loading_beat',
  'awaiting_student',
  'awaiting_confidence',
  'loading_voices',
  'showing_voices',
  'loading_tea_break',
  'showing_tea_break',
])
