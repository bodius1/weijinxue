/** @param {{ voice: import('../conversation/turnTypes.js').VoiceCard, accent: string }} props */
function VoiceCard({ voice, accent }) {
  return (
    <div
      className="space-y-1 rounded-xl border p-3"
      style={{
        background: '#1A1814',
        borderColor: `${accent}40`,
      }}
    >
      <div className="text-xs font-medium" style={{ color: accent }}>
        {voice.label}
      </div>
      {voice.hanzi ? <div className="text-base font-medium text-[#E8D5A3]">{voice.hanzi}</div> : null}
      {voice.pinyin ? <div className="text-xs text-[#8C7A52]">{voice.pinyin}</div> : null}
      {voice.english ? (
        <div className="text-xs italic text-[#A8956A]">&ldquo;{voice.english}&rdquo;</div>
      ) : null}
      {voice.note ? (
        <div className="border-t border-[#D4A843]/10 pt-1 text-xs text-[#8C7A52]">{voice.note}</div>
      ) : null}
    </div>
  )
}

/** @param {{ luren: import('../conversation/turnTypes.js').VoiceCard }} props */
function LurenCard({ luren }) {
  return (
    <div className="rounded-xl border border-[#D4A843]/20 bg-[#1A1814]/60 p-3">
      <div className="mb-1 text-xs font-medium text-[#D4A843]">{luren.label || '路人 Lùrén'}</div>
      <div className="text-xs text-[#E8D5A3]">💡 {luren.note}</div>
    </div>
  )
}

/** @param {{ alternatives: import('../conversation/turnTypes.js').GradingAlternative[] }} props */
function AlternativesList({ alternatives }) {
  const visible = (alternatives ?? []).filter((alt) => String(alt?.hanzi ?? '').trim())
  if (!visible.length) return null
  return (
    <div className="rounded-xl border border-[#D4A843]/20 bg-[#0F0E0C]/80 p-3">
      <p className="mb-2 text-xs font-medium text-[#D4A843]">Other ways to say this</p>
      <ol className="space-y-2">
        {visible.map((alt, i) => (
          <li key={`${alt.hanzi}-${i}`} className="text-sm">
            <span className="font-medium text-[#E8D5A3]">
              {i + 1}. {alt.hanzi}
            </span>
            {alt.pinyin ? <span className="ml-2 text-xs text-[#8C7A52]">{alt.pinyin}</span> : null}
            {alt.english ? (
              <span className="ml-1 text-xs italic text-[#A8956A]">&mdash; {alt.english}</span>
            ) : null}
            {alt.note ? <span className="ml-1 text-[10px] text-[#8C7A52]/80">({alt.note})</span> : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

const EVAL_STYLES = {
  correct: { color: '#7BA821', emoji: '✓', label: 'Correct', border: 'border-[#7BA821]/30', bg: 'bg-[#7BA821]/5' },
  almost: {
    color: '#D4A843',
    emoji: '~',
    label: 'Close',
    border: 'border-[#D4A843]/40',
    bg: 'bg-[#D4A843]/5',
  },
  wrong: { color: '#E24B4A', emoji: '✗', label: 'Needs work', border: 'border-[#E24B4A]/30', bg: 'bg-[#E24B4A]/5' },
  off_task: { color: '#C97B4A', emoji: '↷', label: 'Off task', border: 'border-[#C97B4A]/30', bg: 'bg-[#C97B4A]/5' },
  skipped: { color: '#8C7A52', emoji: '–', label: 'Skipped', border: 'border-[#8C7A52]/30', bg: 'bg-[#8C7A52]/5' },
}

/**
 * @param {{
 *   response: import('../conversation/turnTypes.js').ThreeVoicesResponse,
 *   onContinue: () => void,
 *   onRecovery?: () => void,
 *   showContinue?: boolean,
 * }} props
 */
export function ThreeVoices({ response, onContinue, onRecovery, showContinue = true }) {
  if (!response) return null

  const {
    evaluation,
    voices,
    encouragement,
    studentReply,
    studentReplyAsHanzi,
    alternatives = [],
    allowRecoveryButton,
    recoveryButtonText,
    likelyTypo,
    likelyIntended,
    studentWrote,
    taskType,
    taskCompleted,
    recoveryApplied,
  } = response

  const style = EVAL_STYLES[evaluation] ?? EVAL_STYLES.almost

  const showTeacherFull =
    evaluation === 'wrong' || evaluation === 'off_task' || evaluation === 'almost'
  const showTeacherBrief = evaluation === 'correct' && !likelyTypo

  return (
    <div
      className={[
        'space-y-3 rounded-xl border p-3',
        style.border ?? 'border-transparent',
        style.bg ?? '',
      ].join(' ')}
    >
      {evaluation === 'almost' ? (
        <p className="text-sm italic text-[#A8956A]">Almost — here&apos;s how to sharpen it.</p>
      ) : null}
      {response.confidence === 'sure' && evaluation === 'wrong' && !recoveryApplied ? (
        <div className="rounded-lg border border-[#D4A843]/60 bg-gradient-to-r from-[#E24B4A]/20 to-[#D4A843]/20 p-3">
          <div className="mb-1 text-xs font-medium text-[#D4A843]">💡 Key learning moment</div>
          <p className="text-sm text-[#E8D5A3]">
            You were sure — but this one needs a closer look. These corrections stick the longest.
          </p>
        </div>
      ) : null}

      {recoveryApplied ? (
        <p className="text-center text-xs text-[#7BA821]">✓ Updated with your intended answer</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ background: `${style.color}22`, color: style.color }}
        >
          {style.emoji} {style.label}
        </span>
        {taskType ? (
          <span className="text-[10px] text-[#8C7A52]/80">{taskType.replace(/_/g, ' ')}</span>
        ) : null}
        <span className="text-xs italic text-[#8C7A52]">You wrote: &ldquo;{studentReply}&rdquo;</span>
        {studentReplyAsHanzi &&
        studentReplyAsHanzi !== studentReply &&
        studentReplyAsHanzi !== 'unable to parse' ? (
          <span className="text-xs text-[#A8956A]">→ {studentReplyAsHanzi}</span>
        ) : null}
      </div>

      {evaluation === 'off_task' ? (
        <p className="text-sm text-[#E8D5A3]">
          This was understandable, but the scene needed a simpler reply for your level.
          {taskType ? ` (Task: ${taskType.replace(/_/g, ' ')})` : ''}
        </p>
      ) : null}

      {likelyTypo && likelyIntended && !recoveryApplied ? (
        <p className="text-sm text-[#E8D5A3]">
          Almost — you may have meant <span className="font-medium text-[#D4A843]">{likelyIntended}</span>
          {studentWrote && studentWrote !== likelyIntended ? (
            <span className="text-[#8C7A52]"> (you wrote {studentWrote})</span>
          ) : null}
          .
        </p>
      ) : null}

      {allowRecoveryButton && likelyIntended && onRecovery && !recoveryApplied ? (
        <button
          type="button"
          onClick={onRecovery}
          className="w-full rounded-lg border border-[#D4A843]/50 bg-[#D4A843]/10 py-2 text-sm font-medium text-[#D4A843] transition hover:bg-[#D4A843]/20"
        >
          {recoveryButtonText || `I meant ${likelyIntended}`}
        </button>
      ) : null}

      {showTeacherBrief || showTeacherFull ? <VoiceCard voice={voices.laoshi} accent="#D4A843" /> : null}

      {evaluation !== 'correct' || voices.pengyou?.hanzi ? (
        <VoiceCard voice={voices.pengyou} accent="#A8956A" />
      ) : null}

      {voices.luren?.note ? <LurenCard luren={voices.luren} /> : null}

      {(evaluation === 'correct' || evaluation === 'almost') &&
      alternatives.some((a) => String(a?.hanzi ?? '').trim()) ? (
        <AlternativesList alternatives={alternatives} />
      ) : null}

      {encouragement ? (
        <p className="mt-2 text-center text-sm italic text-[#E8D5A3]">{encouragement}</p>
      ) : null}

      {evaluation === 'wrong' && !allowRecoveryButton ? (
        <p className="text-center text-[10px] text-[#8C7A52]">Try a shorter reply next time — one idea is enough.</p>
      ) : null}

      {showContinue ? (
        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-lg bg-[#D4A843] py-2.5 font-medium text-[#0F0E0C] transition hover:brightness-110"
        >
          Continue the story →
        </button>
      ) : null}
    </div>
  )
}
