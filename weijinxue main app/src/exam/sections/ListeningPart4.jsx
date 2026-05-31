import { choiceOptionClasses } from '../reviewStyles.js'

const CARD = 'rounded-[10px] border border-[#D4A843]/20 bg-[#1A1814] px-3.5 py-3'

export default function ListeningPart4({
  exam,
  answers,
  setAnswer,
  reviewMode = false,
  questionNumber,
  userAnswers,
  answerKey,
}) {
  const section = exam.sections.listeningPart4
  const ua = reviewMode ? userAnswers : answers
  const questions = questionNumber
    ? section.questions.filter((q) => q.q === questionNumber)
    : section.questions
  const lastQ = questions[questions.length - 1]?.q
  const oddCount = questions.length % 2 === 1

  return (
    <section className="space-y-4 text-[#E8D5A3]">
      {!questionNumber ? <p className="text-sm text-[#8C7A52]">{section.instructions}</p> : null}
      <div className="grid grid-cols-2 gap-2.5">
        {questions.map((q) => (
          <article
            key={q.q}
            className={[
              CARD,
              oddCount && q.q === lastQ ? 'col-span-2 max-w-[50%] justify-self-start' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <p className="mb-1.5 text-xs font-medium text-[#D4A843]">Q{q.q}</p>
            <div className="flex flex-col gap-1.5">
              {Object.entries(q.options).map(([label, text]) => {
                const optionClass = choiceOptionClasses({
                  reviewMode,
                  optionLabel: label,
                  userAnswer: ua?.[q.q],
                  correctAnswer: answerKey?.[q.q],
                  baseClass:
                    'w-full rounded-md border px-3 py-1.5 text-left text-[13px] transition-colors duration-200',
                })
                const body = (
                  <>
                    <span className="font-semibold">{label}.</span> {text}
                  </>
                )
                if (reviewMode) {
                  return (
                    <div key={label} className={optionClass}>
                      {body}
                    </div>
                  )
                }
                return (
                  <button key={label} type="button" onClick={() => setAnswer(q.q, label)} className={optionClass}>
                    {body}
                  </button>
                )
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
