import { useCallback, useMemo, useState } from 'react'
import CharacterDisplay from '../components/CharacterDisplay.jsx'
import PinyinSearch from '../components/PinyinSearch.jsx'
import QuickQuiz from '../components/QuickQuiz.jsx'
import StrokeOrder from '../components/StrokeOrder.jsx'
import { lookupDeckEntryByHanzi } from '../utils/ankiDeckData.js'
import { pushRecentCharacter } from '../utils/recentCharacters.js'
import { isLearnedSaved, toggleLearnedCharacter } from '../utils/learnedCharacters.js'

const DEFAULT_ENTRY = {
  char: '学',
  pinyin: 'xué',
  meaning: 'to study / to learn',
  audio: null,
  hanzi: '学',
  traditional: null,
  wordType: null,
  hskLevel: null,
}

/** Same width for hero search and character card (max 512px, centered). */
const LEARN_COLUMN = 'mx-auto w-full max-w-lg'

function allHanChars(s) {
  if (!s) return ['学']
  const out = [...s].filter((ch) => /^[\u4e00-\u9fff]$/u.test(ch))
  return out.length ? out : ['学']
}

function IconStrokeOrder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" className="h-8 w-8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  )
}

function IconExamples() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" className="h-8 w-8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
      />
    </svg>
  )
}

function IconBookmark({ filled }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} strokeWidth="1.5" stroke="currentColor" className="h-8 w-8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
    </svg>
  )
}

export default function LearnTab() {
  const [entry, setEntry] = useState(DEFAULT_ENTRY)
  const [strokeOpen, setStrokeOpen] = useState(false)
  const [examplesOpen, setExamplesOpen] = useState(false)

  const strokeChars = useMemo(() => allHanChars(entry.char), [entry.char])
  const isSaved = isLearnedSaved(entry.char)

  const handleToggleSave = useCallback(() => {
    toggleLearnedCharacter({
      simplified: entry.char,
      pinyin: entry.pinyin,
      meaning: entry.meaning,
    })
    setEntry((e) => ({ ...e }))
  }, [entry.char, entry.pinyin, entry.meaning])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-paper px-3 text-ink sm:px-4">
      <div className={`${LEARN_COLUMN} shrink-0 pb-1 pt-2 sm:pb-2 sm:pt-3`}>
        <PinyinSearch
          variant="hero"
          onSelect={(sel) => {
            const deck = lookupDeckEntryByHanzi(sel.simplified)
            const pinyinShown =
              deck?.pinyin && String(deck.pinyin).trim() ? String(deck.pinyin).trim() : sel.pinyinDisplay
            setEntry({
              char: sel.simplified,
              pinyin: pinyinShown,
              meaning: deck?.meaning ?? sel.english.join(' / '),
              audio: deck?.audio ?? null,
              hanzi: deck?.hanzi ?? sel.simplified,
              traditional: deck?.traditional ?? sel.traditional,
              wordType: deck?.wordType ?? null,
              hskLevel: deck?.hskLevel ?? null,
            })
            pushRecentCharacter(sel.simplified, pinyinShown)
          }}
        />
      </div>

      <div className={`${LEARN_COLUMN} mb-2 flex min-h-0 shrink-0 flex-col rounded-2xl border border-taupe bg-parchment shadow-sm`}>
        <CharacterDisplay
          embedded
          character={entry.char}
          pinyin={entry.pinyin}
          meaning={entry.meaning}
          selectedEntry={entry}
        />

        <div
          className={[
            'overflow-hidden transition-[max-height] duration-300 ease-out',
            strokeOpen ? 'max-h-[min(90dvh,720px)]' : 'max-h-0',
          ].join(' ')}
        >
          <div className="max-h-[min(90dvh,720px)] overflow-y-auto border-t border-taupe bg-elevated">
            <StrokeOrder characters={strokeChars} isOpen={strokeOpen} />
          </div>
        </div>

        <div className="mt-6 shrink-0 border-t border-taupe pt-3 pb-3">
          <div className="flex items-center justify-center gap-1.5 px-2">
            <button
              type="button"
              className={[
                'flex items-center justify-center rounded-xl p-3 transition',
                strokeOpen
                  ? 'bg-clay text-paper'
                  : 'text-clay hover:bg-elevated hover:text-ink',
              ].join(' ')}
              aria-label="Stroke order"
              aria-expanded={strokeOpen}
              aria-controls="stroke-order-panel"
              onClick={() => setStrokeOpen((o) => !o)}
            >
              <IconStrokeOrder />
            </button>
            <button
              type="button"
              className={[
                'flex items-center justify-center rounded-xl p-3 transition',
                examplesOpen
                  ? 'bg-clay text-paper'
                  : 'text-clay hover:bg-elevated hover:text-ink',
              ].join(' ')}
              aria-label="Examples practice"
              aria-expanded={examplesOpen}
              aria-controls="examples-practice-panel"
              onClick={() => setExamplesOpen((o) => !o)}
            >
              <IconExamples />
            </button>
            <button
              type="button"
              className={[
                'flex items-center justify-center rounded-xl p-3 transition',
                isSaved ? 'bg-clay text-paper' : 'text-clay hover:bg-elevated hover:text-ink',
              ].join(' ')}
              aria-label={isSaved ? 'Remove from saved words' : 'Save word'}
              aria-pressed={isSaved}
              onClick={handleToggleSave}
            >
              <IconBookmark filled={isSaved} />
            </button>
          </div>

          <div
            className={[
              'overflow-hidden transition-[max-height] duration-300 ease-out',
              examplesOpen ? 'max-h-[min(85dvh,640px)]' : 'max-h-0',
            ].join(' ')}
          >
            <div className="max-h-[min(85dvh,640px)] overflow-y-auto bg-elevated">
              <QuickQuiz entry={entry} isOpen={examplesOpen} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
