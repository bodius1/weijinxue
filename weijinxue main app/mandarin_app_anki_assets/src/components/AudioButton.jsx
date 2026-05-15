import { useRef, useState } from "react";

export default function AudioButton({ term, audioMap, audioFile, className = "" }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const filename = audioFile || audioMap?.[term];

  async function playAudio() {
    if (!filename) return;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const encodedFilename = encodeURIComponent(filename);
      const audio = new Audio(`/anki-audio/${encodedFilename}`);
      audioRef.current = audio;

      setIsPlaying(true);

      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        console.error(`Could not load audio file: ${filename}`);
        setIsPlaying(false);
      };

      await audio.play();
    } catch (error) {
      console.error("Audio playback failed:", error);
      setIsPlaying(false);
    }
  }

  return (
    <button
      type="button"
      onClick={playAudio}
      disabled={!filename || isPlaying}
      className={`rounded-full border px-4 py-2 text-xl transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800 ${className}`}
      title={filename ? `Play audio for ${term}` : "No audio available"}
      aria-label={filename ? `Play audio for ${term}` : "No audio available"}
    >
      {isPlaying ? "🔊" : "🔈"}
    </button>
  );
}
