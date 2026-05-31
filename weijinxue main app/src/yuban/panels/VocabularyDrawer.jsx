import { useMemo, useState } from 'react'
import { classifyVocabMastery } from '../helpers/vocabHelpers.js'

/** @typedef {'all' | 'warm' | 'cold' | 'mastered'} VocabFilter */

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   state: { vocabulary?: Record<string, object>, sessionsCompleted?: number } | null,
 * }} props
 */
export default function VocabularyDrawer({ open, onClose, state }) {
  const [filter, setFilter] = useState(/** @type {VocabFilter} */ ('all'))

  const classified = useMemo(() => classifyVocabMastery(state ?? {}), [state])

  const rows = useMemo(() => {
    const list = Object.entries(classified).map(([hanzi, data]) => ({
      hanzi,
      ...data,
    }))
    list.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
    if (filter === 'all') return list
    return list.filter((r) => r.mastery === filter)
  }, [classified, filter])

  if (!open) return null

  const tabs = /** @type {const} */ ([
    { id: 'all', label: 'All' },
    { id: 'warm', label: 'Warm' },
    { id: 'cold', label: 'Cold' },
    { id: 'mastered', label: 'Mastered' },
  ])

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/50"
      role="dialog"
      aria-modal
      aria-labelledby="story-vocab-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-[rgba(212,168,67,0.2)] bg-[#1A1814] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgba(212,168,67,0.15)] px-4 py-3">
          <h2 id="story-vocab-title" className="text-sm font-semibold text-[#E8D5A3]">
            Words learned
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[#8C7A52] hover:bg-[#0F0E0C] hover:text-[#E8D5A3]"
          >
            Close
          </button>
        </div>

        <div className="flex gap-1 border-b border-[rgba(212,168,67,0.15)] px-3 py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={[
                'rounded-md px-2.5 py-1 text-xs font-medium transition',
                filter === tab.id
                  ? 'bg-[#D4A843]/20 text-[#D4A843]'
                  : 'text-[#8C7A52] hover:text-[#E8D5A3]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#8C7A52]">No words in this filter yet.</p>
          ) : (
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.06em] text-[#D4A843]">
                  <th className="pb-2 pr-2 font-medium">Hanzi</th>
                  <th className="pb-2 pr-2 font-medium">Pinyin</th>
                  <th className="pb-2 pr-2 font-medium">English</th>
                  <th className="pb-2 pr-2 font-medium">Seen</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-[#E8D5A3]">
                {rows.map((row) => (
                  <tr key={row.hanzi} className="border-t border-[rgba(212,168,67,0.1)]">
                    <td className="py-2 pr-2 font-medium">{row.hanzi}</td>
                    <td className="py-2 pr-2 text-[#8C7A52]">{row.pinyin || '—'}</td>
                    <td className="py-2 pr-2 text-[#8C7A52]">{row.english || '—'}</td>
                    <td className="py-2 pr-2 tabular-nums text-[#8C7A52]">{row.encounterCount ?? 0}</td>
                    <td className="py-2">
                      <MasteryBadge mastery={row.mastery} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

/** @param {{ mastery?: string }} props */
function MasteryBadge({ mastery }) {
  if (mastery === 'mastered') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-emerald-400/90">
        ✓ mastered
      </span>
    )
  }
  if (mastery === 'cold') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-[#8C7A52]">
        ❄️ cold
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-[#D4A843]">
      🔥 warm
    </span>
  )
}
