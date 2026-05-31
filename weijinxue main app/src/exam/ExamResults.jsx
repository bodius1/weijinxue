function scoreRange(answers, answerKey, start, end) {
  let correct = 0
  for (let q = start; q <= end; q += 1) {
    if (answers[q] === answerKey[q]) correct += 1
  }
  return correct
}

export default function ExamResults({ exam, answers, onTryAgain, onReview, onBack }) {
  const listening = scoreRange(answers, exam.answerKey, 1, 20)
  const reading = scoreRange(answers, exam.answerKey, 21, 40)
  const total = listening + reading
  const percent = Math.round((total / 40) * 100)
  const passed = total >= 24

  return (
    <section className="rounded-3xl border border-[#D4A843]/30 bg-[#1A1814] p-5 text-[#E8D5A3]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#D4A843]">{exam.title}</h2>
        <p className="text-sm text-[#8C7A52]">{exam.examId}</p>
      </div>
      <div className="mx-auto mt-6 max-w-md rounded-2xl border border-[#D4A843]/30 bg-[#0F0E0C] p-5">
        <h3 className="text-center text-xl font-bold text-[#D4A843]">Your Score</h3>
        <div className="mt-5 space-y-2 text-sm">
          <p className="flex justify-between">
            <span>Listening:</span>
            <span>{listening}/20</span>
          </p>
          <p className="flex justify-between">
            <span>Reading:</span>
            <span>{reading}/20</span>
          </p>
          <p className="flex justify-between border-t border-[#D4A843]/20 pt-2 font-bold">
            <span>Total:</span>
            <span>{total}/40</span>
          </p>
        </div>
        <div className="mt-5">
          <div className="h-3 overflow-hidden rounded-full bg-[#1A1814]">
            <div className="h-full rounded-full bg-[#D4A843]" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-center text-sm text-[#8C7A52]">{percent}% (Pass: 60%)</p>
        </div>
        <p className={['mt-5 text-center text-2xl font-bold', passed ? 'text-[#D4A843]' : 'text-red-400'].join(' ')}>
          {passed ? 'PASS' : 'Please Try Again'}
        </p>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-[#D4A843]/30 px-4 py-2 text-sm font-semibold text-[#E8D5A3] transition-all duration-200 hover:border-[#D4A843]"
        >
          Back to Exams
        </button>
        <button
          type="button"
          onClick={onReview}
          className="rounded-xl border border-[#D4A843] px-4 py-2 text-sm font-semibold text-[#D4A843] transition-all duration-200 hover:bg-[#D4A843]/10"
        >
          Review Exam 📋
        </button>
        <button
          type="button"
          onClick={onTryAgain}
          className="rounded-xl border border-[#D4A843] bg-[#D4A843]/15 px-4 py-2 text-sm font-semibold text-[#D4A843] transition-all duration-200 hover:bg-[#D4A843] hover:text-[#0F0E0C]"
        >
          Try Again
        </button>
      </div>
    </section>
  )
}
