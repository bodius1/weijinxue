import { useState } from 'react'

/**
 * @param {{ studentReply: string, onConfirm: (level: string) => void }} props
 */
export function ConfidenceGate({ studentReply, onConfirm }) {
  const [selected, setSelected] = useState(/** @type {string | null} */ (null))

  const choices = [
    { id: 'sure', emoji: '🎯', label: 'Sure', color: '#D4A843' },
    { id: 'pretty_sure', emoji: '🤔', label: 'Pretty sure', color: '#A8956A' },
    { id: 'guessing', emoji: '🎲', label: 'Guessing', color: '#8C7A52' },
  ]

  return (
    <div className="space-y-3 rounded-xl border border-[#D4A843]/30 bg-[#1A1814] p-4">
      <div>
        <p className="text-xs font-medium text-[#D4A843]">Quick check</p>
        <p className="mt-1 text-xs italic text-[#8C7A52]">You wrote: &ldquo;{studentReply}&rdquo;</p>
        <p className="mt-2 text-sm text-[#E8D5A3]">How sure are you about that reply?</p>
      </div>

      <div className="flex justify-center gap-2">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setSelected(c.id)
              window.setTimeout(() => onConfirm(c.id), 200)
            }}
            className="flex flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-all"
            style={{
              borderColor: selected === c.id ? c.color : `${c.color}40`,
              background: selected === c.id ? `${c.color}22` : 'transparent',
              color: c.color,
            }}
          >
            <span className="text-lg">{c.emoji}</span>
            <span className="text-xs font-medium">{c.label}</span>
          </button>
        ))}
      </div>

      <p className="text-center text-[10px] italic text-[#8C7A52]/60">
        Honest answers help Yǔbàn teach you better.
      </p>
    </div>
  )
}
