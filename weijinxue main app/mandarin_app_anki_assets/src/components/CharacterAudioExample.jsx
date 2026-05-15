import AudioButton from "./AudioButton";
import audioMap from "../data/audioMap.json";

export default function CharacterAudioExample({ selectedEntry }) {
  if (!selectedEntry) return null;

  const term = selectedEntry.hanzi || selectedEntry.simplified || selectedEntry.word || selectedEntry.character;
  const audioFile = selectedEntry.audio || audioMap[term];

  return (
    <div className="flex items-center gap-3">
      <div>
        <div className="text-2xl font-semibold">{term}</div>
        <div className="text-gray-500">{selectedEntry.pinyin}</div>
      </div>
      <AudioButton term={term} audioMap={audioMap} audioFile={audioFile} />
    </div>
  );
}
