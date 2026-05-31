import { examImageSrc } from '../imagePath.js'
import { choiceOptionClasses } from '../reviewStyles.js'

const LABELS = ['A', 'B', 'C']

export default function ListeningPart2({
  exam,
  answers,
  setAnswer,
  reviewMode = false,
  questionNumber,
  userAnswers,
  answerKey,
}) {
  const section = exam.sections.listeningPart2
  const ua = reviewMode ? userAnswers : answers
  const questions = questionNumber
    ? section.questions.filter((q) => q.q === questionNumber)
    : section.questions

  return (
    <section className="space-y-4 text-[#E8D5A3]">
      {!questionNumber ? <p className="text-sm text-[#8C7A52]">{section.instructions}</p> : null}
      {questions.map((q) => (
        <article key={q.q} className="rounded-2xl border border-[#D4A843]/30 bg-[#1A1814] p-4">
          <p className="mb-3 text-sm font-semibold text-[#D4A843]">Question {q.q}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {q.images.map((file, i) => {
              const label = LABELS[i]
              const optionClass = choiceOptionClasses({
                reviewMode,
                optionLabel: label,
                userAnswer: ua?.[q.q],
                correctAnswer: answerKey?.[q.q],
                baseClass: 'rounded-xl border bg-[#1A1814] p-2 text-left transition-colors duration-200',
              })
              const inner = (
                <>
                  <span className="mb-2 block text-xs font-semibold">{label}</span>
                  <img
                    src={examImageSrc(exam.examId, file)}
                    alt={`Question ${q.q} option ${label}`}
                    className="h-36 w-full rounded-lg object-contain"
                  />
                </>
              )
              if (reviewMode) {
                return (
                  <div key={file} className={optionClass}>
                    {inner}
                  </div>
                )
              }
              return (
                <button key={file} type="button" onClick={() => setAnswer(q.q, label)} className={optionClass}>
                  {inner}
                </button>
              )
            })}
          </div>
        </article>
      ))}
    </section>
  )
}
