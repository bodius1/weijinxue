import { useEffect, useRef, useState } from 'react'
import { REVIEW_SECTIONS, sectionForQuestion } from './examReviewConfig.js'
import ListeningPart1 from './sections/ListeningPart1.jsx'
import ListeningPart2 from './sections/ListeningPart2.jsx'
import ListeningPart3 from './sections/ListeningPart3.jsx'
import ListeningPart4 from './sections/ListeningPart4.jsx'
import ReadingPart1 from './sections/ReadingPart1.jsx'
import ReadingPart2 from './sections/ReadingPart2.jsx'
import ReadingPart3 from './sections/ReadingPart3.jsx'
import ReadingPart4 from './sections/ReadingPart4.jsx'

const SECTION_COMPONENTS = {
  listening_part1: ListeningPart1,
  listening_part2: ListeningPart2,
  listening_part3: ListeningPart3,
  listening_part4: ListeningPart4,
  reading_part1: ReadingPart1,
  reading_part2: ReadingPart2,
  reading_part3: ReadingPart3,
  reading_part4: ReadingPart4,
}

function scoreRange(answers, answerKey, start, end) {
  let correct = 0
  for (let q = start; q <= end; q += 1) {
    if (answers[q] === answerKey[q]) correct += 1
  }
  return correct
}

function mmss(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function ReviewAudioPlayer({ exam, audioKey }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const item = exam.audio[audioKey]

  useEffect(() => {
    setPlaying(false)
    setProgress(0)
    setCurrentTime(0)
    audioRef.current?.load()
  }, [audioKey])

  if (!item) return null

  return (
    <div className="mb-4 rounded-2xl border border-[#D4A843]/30 bg-[#0F0E0C] p-4">
      <p className="mb-2 text-xs text-[#8C7A52]">🎧 Tap to replay audio</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-[#D4A843]">Listening audio</p>
          <p className="text-xs text-[#8C7A52]">Duration {mmss(item.durationSec)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const audio = audioRef.current
            if (!audio) return
            if (audio.paused) void audio.play()
            else audio.pause()
          }}
          className="rounded-xl border border-[#D4A843] px-4 py-2 text-sm font-semibold text-[#D4A843] transition-all duration-200 hover:bg-[#D4A843] hover:text-[#0F0E0C]"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={progress}
        onChange={(e) => {
          const audio = audioRef.current
          const next = Number(e.target.value)
          setProgress(next)
          if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
            audio.currentTime = (next / 100) * audio.duration
            setCurrentTime(audio.currentTime)
          }
        }}
        className="mt-3 h-2 w-full cursor-pointer rounded-full"
        style={{ accentColor: '#ffffff' }}
        aria-label="Seek audio"
      />
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[#8C7A52]">
        <span>{mmss(Math.floor(currentTime))}</span>
        <span>{mmss(item.durationSec)}</span>
      </div>
      <audio
        ref={audioRef}
        src={`/exams/${exam.examId}/audio/${item.file}`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget
          setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0)
          setCurrentTime(a.currentTime)
        }}
      />
    </div>
  )
}

export default function ExamReview({ examData, userAnswers, answerKey, onFinish, onBack }) {
  const [currentQ, setCurrentQ] = useState(1)
  const isSummary = currentQ > 40
  const sectionMeta = isSummary ? null : sectionForQuestion(currentQ)
  const SectionComponent = sectionMeta ? SECTION_COMPONENTS[sectionMeta.id] : null

  const listening = scoreRange(userAnswers, answerKey, 1, 20)
  const reading = scoreRange(userAnswers, answerKey, 21, 40)

  const reviewProps = {
    exam: examData,
    answers: userAnswers,
    setAnswer: () => {},
    reviewMode: true,
    questionNumber: isSummary ? undefined : currentQ,
    userAnswers,
    answerKey,
  }

  const goPrev = () => setCurrentQ((q) => Math.max(1, q - 1))
  const goNext = () => setCurrentQ((q) => Math.min(41, q + 1))

  return (
    <div className="space-y-4 text-[#E8D5A3]">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4A843]/30 bg-[#1A1814] p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-[#D4A843]/30 px-2 py-1 text-lg text-[#D4A843] transition-all duration-200 hover:border-[#D4A843]"
            aria-label="Back to results"
          >
            ←
          </button>
          <div>
            <h2 className="text-sm font-semibold text-[#8C7A52]">
              Review — HSK {examData.hskLevel} Exam {examData.examNumber}
            </h2>
            <p className="text-xs text-[#8C7A52]">{examData.examId}</p>
          </div>
        </div>
        <p className="text-sm font-semibold tabular-nums text-[#D4A843]">
          {isSummary ? 'Complete' : `Q${currentQ} / 40`}
        </p>
      </header>

      {isSummary ? (
        <div className="rounded-3xl border border-[#D4A843]/30 bg-[#1A1814] p-8 text-center">
          <h3 className="text-2xl font-bold text-[#D4A843]">Review Complete ✓</h3>
          <p className="mt-3 text-[#8C7A52]">You reviewed all 40 questions.</p>
          <p className="mt-6 text-lg text-[#E8D5A3]">
            Listening: <span className="font-semibold text-[#D4A843]">{listening}/20</span>
            <span className="mx-3 text-[#8C7A52]">|</span>
            Reading: <span className="font-semibold text-[#D4A843]">{reading}/20</span>
          </p>
          <button
            type="button"
            onClick={onFinish}
            className="mt-8 rounded-xl border border-[#D4A843] bg-[#D4A843]/15 px-6 py-3 text-sm font-semibold text-[#D4A843] transition-all duration-200 hover:bg-[#D4A843] hover:text-[#0F0E0C]"
          >
            Back to Results
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-[#8C7A52]">{sectionMeta.sectionLabel}</p>
          {sectionMeta.audioKey ? (
            <ReviewAudioPlayer exam={examData} audioKey={sectionMeta.audioKey} />
          ) : null}
          {SectionComponent ? <SectionComponent {...reviewProps} /> : null}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4A843]/30 bg-[#1A1814] p-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentQ <= 1}
          className="rounded-xl border border-[#D4A843]/30 px-4 py-2 text-sm font-semibold text-[#E8D5A3] transition-all duration-200 hover:border-[#D4A843] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Previous
        </button>
        <label className="flex items-center gap-2 text-sm text-[#8C7A52]">
          Jump to section
          <select
            value={sectionMeta?.id ?? REVIEW_SECTIONS[0].id}
            onChange={(e) => {
              const target = REVIEW_SECTIONS.find((s) => s.id === e.target.value)
              if (target) setCurrentQ(target.qStart)
            }}
            disabled={isSummary}
            className="rounded-lg border border-[#D4A843]/40 bg-[#0F0E0C] px-2 py-1 text-[#E8D5A3] outline-none focus:border-[#D4A843]"
          >
            {REVIEW_SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={goNext}
          disabled={currentQ >= 41}
          className="rounded-xl border border-[#D4A843]/30 px-4 py-2 text-sm font-semibold text-[#D4A843] transition-all duration-200 hover:border-[#D4A843] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
