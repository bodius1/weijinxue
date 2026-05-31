export default function ExamNumberSelect({ level, onBack, onSelect }) {
  return (
    <section className="rounded-3xl border border-[#D4A843]/30 bg-[#1A1814] p-5">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-[#D4A843] transition-all duration-200 hover:text-[#E8D5A3]">← Back</button>
      <h2 className="mt-4 text-center text-2xl font-bold text-[#D4A843]">{level.label} — Select Exam</h2>
      <p className="mt-1 text-center text-sm text-[#8C7A52]">选择试卷</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {level.exams.map((exam) => (
          <button key={exam.examId} type="button" onClick={() => onSelect(exam)} className="rounded-2xl border border-[#D4A843]/30 bg-[#0F0E0C] p-5 text-left transition-all duration-200 hover:border-[#D4A843] hover:bg-[#D4A843]/10">
            <p className="text-xl font-bold text-[#D4A843]">Exam {exam.number}</p>
            <p className="mt-1 text-sm font-semibold text-[#E8D5A3]">{exam.examId}</p>
            <p className="mt-2 text-sm text-[#8C7A52]">Official Hanban practice exam</p>
          </button>
        ))}
      </div>
    </section>
  )
}
