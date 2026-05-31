import { examImageSrc } from '../imagePath.js'
import LetterPillRow from '../LetterPillRow.jsx'

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F']
const CARD = 'rounded-[10px] border border-[#D4A843]/20 bg-[#1A1814] px-3.5 py-3'

export default function ReadingPart2({
  exam,
  answers,
  setAnswer,
  reviewMode = false,
  questionNumber,
  userAnswers,
  answerKey,
}) {
  const section = exam.sections.readingPart2
  const ua = reviewMode ? userAnswers : answers
  const questions = questionNumber
    ? section.questions.filter((q) => q.q === questionNumber)
    : section.questions
  const lastQ = questions[questions.length - 1]?.q
  const oddCount = questions.length % 2 === 1

  return (
    <section className="space-y-4 text-[#E8D5A3]">
      {!questionNumber ? <p className="text-sm text-[#8C7A52]">{section.instructions}</p> : null}
      <div className="grid grid-cols-3 gap-2">
        {section.imageBank.map((item) => (
          <div key={item.label} className="relative mx-auto w-full max-w-[110px]">
            <img
              src={examImageSrc(exam.examId, item.file)}
              alt={`Option ${item.label}`}
              className="w-full rounded-lg object-contain"
            />
            <span className="absolute bottom-1 left-1 rounded bg-[#D4A843] px-1.5 py-px text-[10px] font-semibold text-[#0F0E0C]">
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {questions.map((q) => (
          <div
            key={q.q}
            className={[
              CARD,
              oddCount && q.q === lastQ ? 'col-span-2 max-w-[50%] justify-self-start' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <p className="text-sm text-[#E8D5A3]">
              <span className="font-medium text-[#D4A843]">{q.q}. </span>
              {q.text}
            </p>
            <p className="text-xs text-[#8C7A52]">{q.pinyin}</p>
            <LetterPillRow
              reviewMode={reviewMode}
              compact
              labels={LABELS}
              selected={answers[q.q]}
              userAnswer={ua?.[q.q]}
              correctAnswer={answerKey?.[q.q]}
              onSelect={(label) => setAnswer(q.q, label)}
              className="mt-2"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
