import { Check, X } from '../examIcons.jsx'
import { ANSWER_FALSE, ANSWER_TRUE } from '../examAnswerValues.js'
import { examImageSrc } from '../imagePath.js'
import { choiceIconColor, choiceOptionClasses } from '../reviewStyles.js'

const TF_OPTIONS = [
  { value: ANSWER_TRUE, Icon: Check },
  { value: ANSWER_FALSE, Icon: X },
]

const CARD =
  'flex flex-col items-center gap-2 rounded-[10px] border border-[#D4A843]/20 bg-[#1A1814] p-2.5'

export default function ListeningPart1({
  exam,
  answers,
  setAnswer,
  reviewMode = false,
  questionNumber,
  userAnswers,
  answerKey,
}) {
  const section = exam.sections.listeningPart1
  const ua = reviewMode ? userAnswers : answers
  const questions = questionNumber
    ? section.questions.filter((q) => q.q === questionNumber)
    : section.questions
  const lastQ = questions[questions.length - 1]?.q
  const oddCount = questions.length % 2 === 1

  return (
    <section className="space-y-4 text-[#E8D5A3]">
      {!questionNumber ? <p className="text-sm text-[#8C7A52]">{section.instructions}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        {questions.map((q) => (
          <article
            key={q.q}
            className={[
              CARD,
              oddCount && q.q === lastQ ? 'col-span-2 mx-auto w-full max-w-[50%]' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="self-start text-xs font-medium text-[#D4A843]">Q{q.q}</span>
            <img
              src={examImageSrc(exam.examId, q.image)}
              alt={`Question ${q.q}`}
              className="max-h-[130px] w-full rounded-md object-contain"
            />
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
                      'flex h-[34px] w-[34px] items-center justify-center rounded-lg transition-colors duration-200',
                  })}
                  aria-label={value === ANSWER_TRUE ? 'Yes' : 'No'}
                >
                  <Icon
                    size={15}
                    strokeWidth={2.5}
                    color={choiceIconColor(reviewMode, value, ua?.[q.q], answerKey?.[q.q])}
                  />
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
