import { useState } from 'react'
import { SUGGESTED_NAMES } from '../data/chineseNameBank.js'

/**
 * @param {{
 *   chineseName: string,
 *   pinyinName: string,
 *   onChineseNameChange: (v: string) => void,
 *   onPinyinNameChange: (v: string) => void,
 * }} props
 */
export default function ChineseNamePicker({
  chineseName,
  pinyinName,
  onChineseNameChange,
  onPinyinNameChange,
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  const pickSuggested = (/** @type {typeof SUGGESTED_NAMES[number]} */ entry) => {
    onChineseNameChange(entry.hanzi)
    onPinyinNameChange(entry.pinyin)
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-[#E8D5A3]">Welcome to Yǔbàn AI</h2>
        <p className="mt-2 text-sm text-[#8C7A52]">Your Chinese learning journey begins here.</p>
      </div>

      <div>
        <p className="text-sm text-[#E8D5A3]">Choose a Chinese name for yourself</p>
        <div className="my-3 h-px bg-[rgba(212,168,67,0.15)]" />

        <p className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-[#D4A843]">
          ⭐ Suggested for you
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SUGGESTED_NAMES.slice(0, 4).map((entry) => {
            const selected = chineseName === entry.hanzi
            return (
              <button
                key={entry.hanzi}
                type="button"
                onClick={() => pickSuggested(entry)}
                className={[
                  'rounded-lg border px-2 py-2.5 text-left text-sm transition',
                  selected
                    ? 'border-[#D4A843] bg-[#D4A843]/10 text-[#E8D5A3]'
                    : 'border-[rgba(212,168,67,0.25)] bg-[#0F0E0C] text-[#E8D5A3] hover:border-[#D4A843]/50',
                ].join(' ')}
              >
                <span className="block text-base font-medium">{entry.hanzi}</span>
                <span className="block text-xs text-[#8C7A52]">{entry.pinyin}</span>
              </button>
            )
          })}
        </div>

        <p className="mt-4 mb-2 text-xs text-[#8C7A52]">Or type your own:</p>
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-[#8C7A52]">
              Chinese name
            </span>
            <input
              type="text"
              value={chineseName}
              onChange={(e) => onChineseNameChange(e.target.value)}
              className="w-full rounded-lg border border-[rgba(212,168,67,0.25)] bg-[#0F0E0C] px-3 py-2.5 text-[#E8D5A3] outline-none focus:border-[#D4A843]/60 focus:ring-1 focus:ring-[#D4A843]/30"
              placeholder="李明"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-[#8C7A52]">Pinyin</span>
            <input
              type="text"
              value={pinyinName}
              onChange={(e) => onPinyinNameChange(e.target.value)}
              className="w-full rounded-lg border border-[rgba(212,168,67,0.25)] bg-[#0F0E0C] px-3 py-2.5 text-[#E8D5A3] outline-none focus:border-[#D4A843]/60 focus:ring-1 focus:ring-[#D4A843]/30"
              placeholder="Lǐ Míng"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="relative mt-3">
          <button
            type="button"
            onClick={() => setShowTooltip((v) => !v)}
            className="text-xs text-[#D4A843] underline-offset-2 hover:underline"
          >
            What&apos;s a good Chinese name?
          </button>
          {showTooltip ? (
            <p className="mt-2 rounded-lg border border-[rgba(212,168,67,0.2)] bg-[#0F0E0C] px-3 py-2 text-xs leading-relaxed text-[#8C7A52]">
              Chinese names are usually two or three characters: family name first (e.g. 李 Lǐ), then
              one or two given-name characters with positive meanings. Learners often pick a name that
              sounds pleasant and is easy to remember.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
