import { Check, X } from '../examIcons.jsx'
import { ANSWER_FALSE, ANSWER_TRUE } from '../examAnswerValues.js'
import { examImageSrc } from '../imagePath.js'
import { choiceIconColor, choiceOptionClasses } from '../reviewStyles.js'

const TF_OPTIONS = [
  { value: ANSWER_TRUE, Icon: Check },
  { value: ANSWER_FALSE, Icon: X },
]

const CARD =
  'flex flex-col items-center gap-2.5 rounded-[10px] border border-[#D4A843]/20 bg-[#1A1814] p-3'

function splitWord(word) {
  const space = word.indexOf(' ')
  if (space === -1) return { han: word, pinyin: '' }
  return { han: word.slice(0, space), pinyin: word.slice(space + 1) }
}

export default function ReadingPart1({
  exam,
  answers,
  setAnswer,
  reviewMode = false,
  questionNumber,
  userAnswers,
  answerKey,
}) {
  const section = exam.sections.readingPart1
  const ua = reviewMode ? userAnswers : answers
  const questions = questionNumber
    ? section.questions.filter((q) => q.q === questionNumber)
    : section.questions
  return (
    <section className="space-y-4 text-[#E8D5A3]">
      {!questionNumber ? <p className="text-sm text-[#8C7A52]">{section.instructions}</p> : null}
      <div className="grid grid-cols-3 items-start gap-2.5">
        {questions.map((q) => {
          const { han, pinyin } = splitWord(q.word)
          return (
            <article key={q.q} className={CARD}>
              <span className="self-start text-xs font-medium text-[#D4A843]">Q{q.q}</span>
              <img
                src={examImageSrc(exam.examId, q.image)}
                alt={`Question ${q.q}`}
                className="max-h-[120px] w-full rounded-lg bg-[#111111] object-contain"
              />
              <p className="text-center">
                <span className="text-lg font-medium text-[#E8D5A3]">{han}</span>
                {pinyin ? <span className="ml-1.5 text-[13px] text-[#8C7A52]">{pinyin}</span> : null}
              </p>
              <div className="flex justify-center gap-2.5">
                {TF_OPTIONS.map(({ value, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    disabled={reviewMode}
                    onClick={() => setAnswer(q.q, value)}
                    className={choiceOptionClasses({
                      reviewMode,
                      optionLabel: value,
                      userAnswer: ua?.[q.q],
                      correctAnswer: answerKey?.[q.q],
                      baseClass:
                        'flex h-[38px] w-[38px] items-center justify-center rounded-lg transition-colors duration-200',
                    })}
                    aria-label={value === ANSWER_TRUE ? 'Yes' : 'No'}
                  >
                    <Icon
                      size={17}
                      strokeWidth={2.5}
                      color={choiceIconColor(reviewMode, value, ua?.[q.q], answerKey?.[q.q])}
                    />
                  </button>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
