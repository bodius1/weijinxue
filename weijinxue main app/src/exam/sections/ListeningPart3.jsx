import { examImageSrc } from '../imagePath.js'
import { choiceOptionClasses } from '../reviewStyles.js'

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

const QUESTION_CARD =
  'flex flex-col gap-2 rounded-[10px] border border-[#D4A843]/20 bg-[#1A1814] px-3 py-2.5'

const PILL_BASE =
  'w-auto shrink-0 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200'

function QuestionCard({ q, answers, setAnswer, reviewMode, ua, answerKey }) {
  return (
    <div className={QUESTION_CARD}>
      <span className="text-xs font-semibold text-[#D4A843]">Q{q.q}</span>
      <div className="flex flex-wrap justify-start gap-1.5">
        {LABELS.map((label) => (
          <button
            key={label}
            type="button"
            disabled={reviewMode}
            onClick={() => setAnswer(q.q, label)}
            className={choiceOptionClasses({
              reviewMode,
              optionLabel: label,
              userAnswer: ua?.[q.q],
              correctAnswer: answerKey?.[q.q],
              baseClass: PILL_BASE,
            })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ListeningPart3({
  exam,
  answers,
  setAnswer,
  reviewMode = false,
  questionNumber,
  userAnswers,
  answerKey,
}) {
  const section = exam.sections.listeningPart3
  const ua = reviewMode ? userAnswers : answers
  const questions = questionNumber
    ? section.questions.filter((q) => q.q === questionNumber)
    : section.questions

  const leftQs = questions.filter((q) => q.q <= 13)
  const rightQs = questions.filter((q) => q.q >= 14)

  return (
    <section className="space-y-4 text-[#E8D5A3]">
      {!questionNumber ? <p className="text-sm text-[#8C7A52]">{section.instructions}</p> : null}
      <div className="grid grid-cols-3 gap-2">
        {section.imageBank.map((item) => (
          <div
            key={item.label}
            className="relative h-[160px] overflow-hidden rounded-lg bg-[#111111]"
          >
            <span className="absolute left-1.5 top-1 z-10 rounded bg-black/60 px-[5px] py-px text-[11px] font-semibold text-[#D4A843]">
              {item.label}
            </span>
            <img
              src={examImageSrc(exam.examId, item.file)}
              alt={`Option ${item.label}`}
              className="h-full w-full object-contain object-center"
            />
          </div>
        ))}
      </div>
      {questionNumber ? (
        <QuestionCard
          q={questions[0]}
          answers={answers}
          setAnswer={setAnswer}
          reviewMode={reviewMode}
          ua={ua}
          answerKey={answerKey}
        />
      ) : (
        <div className="grid grid-cols-[1.5fr_1fr] items-start gap-4">
          <div className="flex flex-col gap-2">
            {leftQs.map((q) => (
              <QuestionCard
                key={q.q}
                q={q}
                answers={answers}
                setAnswer={setAnswer}
                reviewMode={reviewMode}
                ua={ua}
                answerKey={answerKey}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {rightQs.map((q) => (
              <QuestionCard
                key={q.q}
                q={q}
                answers={answers}
                setAnswer={setAnswer}
                reviewMode={reviewMode}
                ua={ua}
                answerKey={answerKey}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
