import AudioButton from './AudioButton.jsx'
import { formatEnglishMeaningForDisplay } from '../utils/formatEnglishMeaning.js'
import { audioMap } from '../utils/ankiDeckData.js'
import { pinyinForDisplay } from '../utils/pinyinToneMark.js'

export default function CharacterDisplay({
  character = '欢迎',
  pinyin = 'huānyíng',
  meaning = 'welcome',
  embedded = false,
  /** When set (e.g. Learn tab), supplies `audio`, `hanzi`, etc. for Anki playback. */
  selectedEntry = null,
}) {
  const shellClass = embedded
    ? 'flex w-full shrink-0 flex-col items-center justify-center px-4 py-6 text-center sm:py-7'
    : 'flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center'

  const term =
    selectedEntry?.hanzi ||
    selectedEntry?.simplified ||
    selectedEntry?.character ||
    selectedEntry?.word ||
    selectedEntry?.term ||
    selectedEntry?.char ||
    character

  const audioFile = selectedEntry?.audio ?? null

  return (
    <div className={shellClass}>
      <div
        className="leading-none font-normal text-ink"
        style={{ fontSize: embedded ? 'clamp(88px, 17vw, 158px)' : 'clamp(100px, 20vw, 180px)' }}
      >
        {character}
      </div>
      <p
        className={[
          'font-normal leading-tight text-espresso',
          embedded ? 'mt-2 text-[clamp(1rem,2.8vw,1.45rem)]' : 'mt-4 text-[clamp(1.1rem,3.2vw,1.65rem)]',
        ].join(' ')}
      >
        {pinyinForDisplay(pinyin)}
      </p>
      <p
        className={[
          'max-w-md leading-snug text-espresso',
          embedded ? 'mt-1.5 text-sm sm:text-[15px]' : 'mt-2 text-[15px] sm:text-[16px]',
        ].join(' ')}
      >
        {formatEnglishMeaningForDisplay(character, meaning)}
      </p>
      <div className={embedded ? 'mt-2 flex justify-center' : 'mt-3 flex justify-center'}>
        <AudioButton term={term} audioFile={audioFile} audioMap={audioMap} />
      </div>
    </div>
  )
}
