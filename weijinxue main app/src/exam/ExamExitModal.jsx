export default function ExamExitModal({ open, onCancel, onExit }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-3xl border border-[#D4A843]/50 bg-[#1A1814] p-6 text-center shadow-2xl">
        <h3 className="text-2xl font-bold text-[#D4A843]">Exit Exam?</h3>
        <p className="mt-4 text-[#E8D5A3]">Your progress will NOT be saved.</p>
        <p className="mt-1 text-sm text-[#8C7A52]">This attempt will be lost.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-[#D4A843]/30 px-4 py-2 text-sm font-semibold text-[#E8D5A3] transition-all duration-200 hover:border-[#D4A843]">
            Cancel
          </button>
          <button type="button" onClick={onExit} className="rounded-xl border border-[#D4A843] bg-[#D4A843]/15 px-4 py-2 text-sm font-semibold text-[#D4A843] transition-all duration-200 hover:bg-[#D4A843] hover:text-[#0F0E0C]">
            Exit Exam
          </button>
        </div>
      </div>
    </div>
  )
}
