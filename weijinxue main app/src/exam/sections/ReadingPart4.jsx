import { SentenceWithBlank } from '../inlineBlank.jsx'
import { choiceOptionClasses } from '../reviewStyles.js'

const CARD = 'rounded-[10px] border border-[#D4A843]/20 bg-[#1A1814] px-3.5 py-3'

/** Strip blank markers from pinyin — blank is shown inline in the sentence only. */
function pinyinLine(pinyin) {
  return pinyin.replace(/（___）|\(___\)/g, '').replace(/\s{2,}/g, ' ').trim()
}

export default function ReadingPart4({
  exam,
  answers,
  setAnswer,
  onSubmit,
  reviewMode = false,
  questionNumber,
  userAnswers,
  answerKey,
}) {
  const section = exam.sections.readingPart4
  const ua = reviewMode ? userAnswers : answers
  const questions = questionNumber
    ? section.questions.filter((q) => q.q === questionNumber)
    : section.questions

  const filledChar = (qNum) => {
    const label = (reviewMode ? ua : answers)?.[qNum]
    return label ? section.wordBank.find((w) => w.label === label)?.char : null
  }

  return (
    <section className="space-y-4 text-[#E8D5A3]">
      {!questionNumber ? <p className="text-sm text-[#8C7A52]">{section.instructions}</p> : null}
      <div className="grid grid-cols-2 gap-2.5">
        {questions.map((q) => (
          <article
            key={q.q}
            className={[CARD, q.q === 40 ? 'col-span-2' : ''].filter(Boolean).join(' ')}
          >
            <p className="max-w-full truncate text-[15px] text-[#E8D5A3]">
              <span className="text-[13px] font-medium text-[#D4A843]">{q.q}. </span>
              <SentenceWithBlank text={q.text} filledChar={filledChar(q.q)} />
            </p>
            <p className="mb-0 max-w-full truncate text-xs text-[#8C7A52]">{pinyinLine(q.pinyin)}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {section.wordBank.map((w) => {
                const optionClass = choiceOptionClasses({
                  reviewMode,
                  optionLabel: w.label,
                  userAnswer: ua?.[q.q],
                  correctAnswer: answerKey?.[q.q],
                  baseClass:
                    'rounded-full px-3 py-1 text-[13px] transition-colors duration-200',
                })
                const label = `${w.label}. ${w.char}`
                if (reviewMode) {
                  return (
                    <span key={w.label} className={optionClass}>
                      {label}
                    </span>
                  )
                }
                return (
                  <button key={w.label} type="button" onClick={() => setAnswer(q.q, w.label)} className={optionClass}>
                    {label}
                  </button>
                )
              })}
            </div>
          </article>
        ))}
      </div>
      {!reviewMode && onSubmit ? (
        <button
          type="button"
          onClick={onSubmit}
          className="w-full rounded-2xl border border-[#D4A843] bg-[#D4A843]/15 px-5 py-4 text-base font-bold text-[#D4A843] transition-all duration-200 hover:bg-[#D4A843] hover:text-[#0F0E0C]"
        >
          提交 Submit
        </button>
      ) : null}
    </section>
  )
}
