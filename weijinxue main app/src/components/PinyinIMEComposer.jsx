/**
 * Pinyin IME UI — shared with Type tab / Yǔbàn classic (see usePinyinIME).
 */

/**
 * @param {{
 *   ime: ReturnType<import('../hooks/usePinyinIME.js').usePinyinIME>,
 *   disabled?: boolean,
 *   placeholder?: string,
 *   variant?: 'type' | 'night',
 *   className?: string,
 * }} props
 */
export function PinyinIMEComposer({
  ime,
  disabled = false,
  placeholder = 'Type in pinyin — characters will appear above…',
  variant = 'night',
  className = '',
}) {
  const {
    rootRef,
    composedHanzi,
    imeInput,
    queryNorm,
    indexReady,
    candidates,
    visibleCandidates,
    phraseCandidates = [],
    candidatesExpanded,
    setCandidatesExpanded,
    canExpandCandidates,
    trySelectSlot,
    trySelectPhrase,
  } = ime

  const isNight = variant === 'night'
  const showGhost = !composedHanzi && !imeInput

  return (
    <div
      ref={rootRef}
      tabIndex={disabled ? -1 : 0}
      data-pinyin-ime-root
      className={[
        'rounded-lg border outline-none transition',
        isNight
          ? 'border-[#D4A843]/20 bg-[#0F0E0C] focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843]/30'
          : 'border-taupe bg-elevated focus-visible:ring-2 focus-visible:ring-clay/30',
        disabled ? 'pointer-events-none opacity-50' : 'cursor-text',
        className,
      ].join(' ')}
      aria-label="Pinyin input"
      onClick={() => {
        if (!disabled) rootRef.current?.focus()
      }}
    >
      <div
        className={[
          'min-h-[2.25rem] border-b px-3 py-2.5 leading-relaxed',
          isNight ? 'border-[#D4A843]/15 text-sm text-[#E8D5A3]' : 'border-taupe/40 text-lg text-ink',
        ].join(' ')}
      >
        {showGhost ? (
          <span className={isNight ? 'text-sm text-[#8C7A52]/60' : 'text-muted'}>{placeholder}</span>
        ) : (
          <span>{composedHanzi}</span>
        )}
      </div>

      <div
        className={[
          'px-3 py-2 font-mono tracking-wide',
          isNight ? 'text-sm text-[#8C7A52]' : 'text-base text-ink sm:text-lg',
        ].join(' ')}
      >
        <span>{imeInput || '\u00a0'}</span>
        <span
          className={[
            'ml-0.5 inline-block h-[0.92em] w-px shrink-0 animate-pulse',
            isNight ? 'bg-[#D4A843]' : 'bg-clay',
          ].join(' ')}
          aria-hidden
        />
      </div>

      <div
        className={[
          'overflow-hidden border-t',
          isNight ? 'border-[#D4A843]/15 bg-[#1A1814]/80' : 'border-taupe bg-parchment/90',
        ].join(' ')}
      >
        <div
          className={[
            'flex items-center justify-between gap-2 border-b px-2 py-2 sm:px-3',
            isNight ? 'border-[#D4A843]/10' : 'border-taupe/40',
          ].join(' ')}
        >
          <div className="flex w-9 shrink-0 justify-start sm:w-10">
            {candidatesExpanded ? (
              <button
                type="button"
                data-pinyin-ime-skip-keys
                onClick={() => setCandidatesExpanded(false)}
                className={[
                  'rounded-full border px-2 py-0.5 text-xs',
                  isNight
                    ? 'border-[#D4A843]/80 text-[#D4A843] hover:border-[#D4A843]'
                    : 'border-taupe/80 text-clay hover:border-clay',
                ].join(' ')}
                aria-label="Show fewer candidates"
              >
                «
              </button>
            ) : (
              <span className="inline-block w-9 sm:w-10" aria-hidden />
            )}
          </div>
          <span className={['min-w-0 flex-1 text-center text-xs', isNight ? 'text-[#8C7A52]' : 'text-muted'].join(' ')}>
            {!indexReady
              ? 'Building dictionary index…'
              : !candidates.length
                ? queryNorm
                  ? 'No matches'
                  : '\u00a0'
                : candidatesExpanded
                  ? '1–9 or Space for #1'
                  : '1–4 or Space for #1'}
          </span>
          <div className="flex w-9 shrink-0 justify-end sm:w-10">
            {!candidatesExpanded && canExpandCandidates ? (
              <button
                type="button"
                data-pinyin-ime-skip-keys
                onClick={() => setCandidatesExpanded(true)}
                className={[
                  'rounded-full border px-2 py-0.5 text-xs',
                  isNight
                    ? 'border-[#D4A843]/80 text-[#D4A843] hover:border-[#D4A843]'
                    : 'border-taupe/80 text-clay hover:border-clay',
                ].join(' ')}
                aria-label="Show more candidates"
              >
                »
              </button>
            ) : (
              <span className="inline-block w-9 sm:w-10" aria-hidden />
            )}
          </div>
        </div>
        <div className="overflow-hidden px-2 py-2 sm:px-3 sm:pb-2">
          {phraseCandidates.length > 0 ? (
            <div className="mb-2 border-b border-[#D4A843]/10 pb-2">
              <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-[#8C7A52]">
                Suggested replies
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {phraseCandidates.map((p) => (
                  <button
                    key={p.hanzi}
                    type="button"
                    data-pinyin-ime-skip-keys
                    onClick={() => trySelectPhrase?.(p.hanzi)}
                    className={[
                      'rounded-full border px-3 py-1.5 text-sm transition',
                      isNight
                        ? 'border-[#D4A843]/50 bg-[#D4A843]/10 text-[#E8D5A3] hover:border-[#D4A843]'
                        : 'border-clay/50 bg-clay/10 text-ink hover:border-clay',
                    ].join(' ')}
                  >
                    {p.hanzi}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {!indexReady ? (
            <p className={['py-3 text-center text-sm', isNight ? 'text-[#8C7A52]' : 'text-muted'].join(' ')}>
              Preparing fast lookup…
            </p>
          ) : visibleCandidates.length === 0 ? (
            <p className={['py-3 text-center text-sm', isNight ? 'text-[#8C7A52]' : 'text-muted'].join(' ')}>
              {queryNorm ? 'No candidates — keep typing' : 'Type letters to see candidates'}
            </p>
          ) : (
            <div
              className={
                candidatesExpanded
                  ? 'grid grid-cols-3 gap-2 overflow-hidden sm:gap-3'
                  : 'flex flex-nowrap justify-center gap-2 overflow-hidden sm:gap-3'
              }
            >
              {visibleCandidates.map((entry, i) => {
                const num = i + 1
                const isHi = i === 0
                return (
                  <button
                    key={`${entry.simplified}-${entry.pinyin}-${num}`}
                    type="button"
                    data-pinyin-ime-skip-keys
                    onClick={() => trySelectSlot(i)}
                    className={[
                      'flex min-w-0 items-baseline justify-center gap-1.5 rounded-full border px-2 py-2.5 text-left transition sm:gap-2 sm:px-4 sm:py-3',
                      candidatesExpanded ? 'w-full max-w-none' : 'max-w-[8.5rem] flex-1 basis-0 sm:max-w-[9.5rem]',
                      isHi
                        ? isNight
                          ? 'border-[#D4A843] ring-2 ring-[#D4A843]/40'
                          : 'border-clay ring-2 ring-clay/40'
                        : isNight
                          ? 'border-[#D4A843]/30'
                          : 'border-taupe/80',
                      isNight ? 'bg-[#0F0E0C] hover:border-[#D4A843]' : 'bg-elevated hover:border-clay',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'shrink-0 text-sm font-bold tabular-nums sm:text-base',
                        isNight ? 'text-[#D4A843]' : 'text-clay',
                      ].join(' ')}
                    >
                      {num}.
                    </span>
                    <span className={['min-w-0 truncate text-lg sm:text-xl', isNight ? 'text-[#E8D5A3]' : 'text-ink'].join(' ')}>
                      {entry.simplified}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
