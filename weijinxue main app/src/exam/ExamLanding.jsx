const cardCls =
  'w-full rounded-2xl border border-[#D4A843]/30 bg-[#1A1814] p-5 text-left transition-all duration-200 hover:border-[#D4A843] hover:bg-[#D4A843]/10'

export default function ExamLanding({ onMock }) {
  return (
    <section className="rounded-3xl border border-[#D4A843]/30 bg-[#1A1814] p-5 shadow-sm">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#D4A843]">考试 Exam</h2>
        <p className="mt-1 text-sm text-[#8C7A52]">Test your HSK proficiency</p>
      </div>
      <div className="mt-6">
        <button type="button" onClick={onMock} className={cardCls}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#D4A843]">Mock Exams 模拟考试</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#E8D5A3]">
                Simulated full-length HSK exams with audio, images, and timed sections
              </p>
            </div>
            <span className="text-2xl text-[#D4A843]">→</span>
          </div>
        </button>
      </div>
    </section>
  )
}
