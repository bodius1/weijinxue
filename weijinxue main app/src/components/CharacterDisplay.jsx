import AudioButton from './AudioButton.jsx'
import { formatEnglishMeaningForDisplay } from '../utils/formatEnglishMeaning.js'
import { audioMap } from '../utils/ankiDeckData.js'
import { pinyinForDisplay } from '../utils/pinyinToneMark.js'

export default function CharacterDisplay({
  character = '学',
  pinyin = 'xué',
  meaning = 'to study / to learn',
  embedded = false,
  /** When set (e.g. Learn tab), supplies `audio`, `hanzi`, etc. for Anki playback. */
  selectedEntry = null,
}) {
  const shellClass = embedded
    ? 'flex w-full shrink-0 flex-col items-center justify-center px-4 py-10 text-center'
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
        style={{ fontSize: 'clamp(100px, 20vw, 180px)' }}
      >
        {character}
      </div>
      <p className="mt-4 text-[clamp(1.1rem,3.2vw,1.65rem)] font-normal leading-tight text-espresso">
        {pinyinForDisplay(pinyin)}
      </p>
      <p className="mt-2 max-w-md text-[15px] leading-snug text-espresso sm:text-[16px]">
        {formatEnglishMeaningForDisplay(character, meaning)}
      </p>
      <div className="mt-3 flex justify-center">
        <AudioButton term={term} audioFile={audioFile} audioMap={audioMap} />
      </div>
    </div>
  )
}
