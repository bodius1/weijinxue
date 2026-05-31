import LetterPillRow from '../LetterPillRow.jsx'

const CARD = 'rounded-[10px] border border-[#D4A843]/20 bg-[#1A1814] px-3.5 py-3'

export default function ReadingPart3({
  exam,
  answers,
  setAnswer,
  reviewMode = false,
  questionNumber,
  userAnswers,
  answerKey,
}) {
  const section = exam.sections.readingPart3
  const labels = section.answers.map((a) => a.label)
  const ua = reviewMode ? userAnswers : answers
  const questions = questionNumber
    ? section.questions.filter((q) => q.q === questionNumber)
    : section.questions

  const answerBank = (
    <div className="flex flex-col gap-1.5">
      <div className="rounded-lg border border-[#D4A843]/25 bg-[#1A1814] px-3 py-2 opacity-80">
        <p className="text-[13px] text-[#E8D5A3]">
          <span className="mr-2 text-xs font-bold text-[#D4A843]">A (example)</span>
          {section.example.q}
        </p>
        <span className="mt-0.5 block text-[11px] text-[#8C7A52]">Answer: {section.example.answer}</span>
      </div>
      {section.answers.map((a) => (
        <div key={a.label} className="rounded-lg border border-[#D4A843]/25 bg-[#1A1814] px-3 py-2">
          <p className="text-[13px] text-[#E8D5A3]">
            <span className="mr-2 text-xs font-bold text-[#D4A843]">{a.label}</span>
            {a.text}
          </p>
          <span className="mt-0.5 block text-[11px] text-[#8C7A52]">{a.pinyin}</span>
        </div>
      ))}
    </div>
  )

  const questionList = (
    <div className="flex flex-col gap-2.5">
      {questions.map((q) => (
        <div key={q.q} className={CARD}>
          <p className="text-sm text-[#E8D5A3]">
            <span className="font-medium text-[#D4A843]">{q.q}. </span>
            {q.text}
          </p>
          <p className="text-xs text-[#8C7A52]">{q.pinyin}</p>
          <LetterPillRow
            reviewMode={reviewMode}
            compact
            labels={labels}
            selected={answers[q.q]}
            userAnswer={ua?.[q.q]}
            correctAnswer={answerKey?.[q.q]}
            onSelect={(label) => setAnswer(q.q, label)}
            className="mt-2"
          />
        </div>
      ))}
    </div>
  )

  return (
    <section className="space-y-4 text-[#E8D5A3]">
      {!questionNumber ? <p className="text-sm text-[#8C7A52]">{section.instructions}</p> : null}
      {questionNumber ? (
        <>
          {answerBank}
          {questionList}
        </>
      ) : (
        <div className="grid grid-cols-[1fr_1.4fr] items-start gap-4">
          {answerBank}
          {questionList}
        </div>
      )}
    </section>
  )
}
