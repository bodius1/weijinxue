# Mandarin App Anki Assets

Generated from `HSK_levels_1_to_6_with_audio_read_speak_and_write.apkg`.

## Contents

- `public/anki-audio/` — 4,990 audio files copied from the Anki deck.
- `src/data/audioMap.json` — maps Hanzi terms to audio filenames.
- `src/data/hskDeckEntries.json` — full entries with Hanzi, Traditional, Pinyin, Meaning, WordType, HSK level, and audio filename.
- `src/data/hskDeckByHanzi.json` — same data keyed by Hanzi.
- `src/components/AudioButton.jsx` — ready-to-use React audio button.

## HSK counts

{
  "1": 149,
  "2": 151,
  "3": 297,
  "4": 598,
  "5": 1297,
  "6": 2498
}

## Basic usage

```jsx
import AudioButton from "./components/AudioButton";
import audioMap from "./data/audioMap.json";

<AudioButton term="你好" audioMap={audioMap} />
```

For entries from `hskDeckEntries.json`, prefer:

```jsx
<AudioButton term={selectedEntry.hanzi} audioFile={selectedEntry.audio} />
```
