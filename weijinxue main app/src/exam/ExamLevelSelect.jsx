export default function ExamLevelSelect({ levels, onBack, onSelect }) {
  return (
    <section className="rounded-3xl border border-[#D4A843]/30 bg-[#1A1814] p-5">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-[#D4A843] transition-all duration-200 hover:text-[#E8D5A3]">← Back</button>
      <h2 className="mt-4 text-center text-2xl font-bold text-[#D4A843]">Select HSK Level</h2>
      <p className="mt-1 text-center text-sm text-[#8C7A52]">选择级别</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {levels.map((level) => (
          <button
            key={level.label}
            type="button"
            disabled={!level.available}
            onClick={() => level.available && onSelect(level)}
            className={[
              'relative rounded-2xl border border-[#D4A843]/30 bg-[#0F0E0C] p-5 text-center transition-all duration-200',
              level.available ? 'hover:border-[#D4A843] hover:bg-[#D4A843]/10' : 'cursor-not-allowed opacity-50',
            ].join(' ')}
          >
            {!level.available ? <span className="absolute right-3 top-3 rounded-full border border-[#D4A843]/40 px-2 py-0.5 text-[10px] text-[#D4A843]">Coming Soon</span> : null}
            <p className="text-5xl font-bold text-[#D4A843]">{level.level}</p>
            <p className="mt-2 font-semibold text-[#E8D5A3]">{level.label}</p>
            <p className="mt-1 text-sm text-[#8C7A52]">{level.description}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
