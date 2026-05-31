import { useCallback, useEffect, useRef, useState } from 'react'
import { useExamState } from './hooks/useExamState.js'
import { useExamTimer } from './hooks/useExamTimer.js'
import ExamExitModal from './ExamExitModal.jsx'
import ListeningPart1 from './sections/ListeningPart1.jsx'
import ListeningPart2 from './sections/ListeningPart2.jsx'
import ListeningPart3 from './sections/ListeningPart3.jsx'
import ListeningPart4 from './sections/ListeningPart4.jsx'
import ReadingPart1 from './sections/ReadingPart1.jsx'
import ReadingPart2 from './sections/ReadingPart2.jsx'
import ReadingPart3 from './sections/ReadingPart3.jsx'
import ReadingPart4 from './sections/ReadingPart4.jsx'

const sectionMeta = {
  listening_part1: { title: '第一部分 Part 1 (Q1-5)', banner: '一、听力 Listening', audioKey: 'part1' },
  listening_part2: { title: '第二部分 Part 2 (Q6-10)', banner: '一、听力 Listening', audioKey: 'part2' },
  listening_part3: { title: '第三部分 Part 3 (Q11-15)', banner: '一、听力 Listening', audioKey: 'part3' },
  listening_part4: { title: '第四部分 Part 4 (Q16-20)', banner: '一、听力 Listening', audioKey: 'part4' },
  answer_card: { title: 'Answer Card Fill', banner: '答题卡 Answer Card' },
  reading_part1: { title: '第一部分 Part 1 (Q21-25)', banner: '二、阅读 Reading' },
  reading_part2: { title: '第二部分 Part 2 (Q26-30)', banner: '二、阅读 Reading' },
  reading_part3: { title: '第三部分 Part 3 (Q31-35)', banner: '二、阅读 Reading' },
  reading_part4: { title: '第四部分 Part 4 (Q36-40)', banner: '二、阅读 Reading' },
}

function mmss(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function AudioPlayer({ exam, audioKey, title, onPlayed }) {
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-[#D4A843]">{title}</p>
          <p className="text-xs text-[#8C7A52]">Duration {mmss(item.durationSec)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const audio = audioRef.current
            if (!audio) return
            if (audio.paused) {
              void audio.play()
              onPlayed()
            } else {
              audio.pause()
            }
          }}
          className="rounded-xl border border-[#D4A843] px-4 py-2 text-sm font-semibold text-[#D4A843] transition-all duration-200 hover:bg-[#D4A843] hover:text-[#0F0E0C]"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
      <div className="mt-3">
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
          className="h-2 w-full cursor-pointer rounded-full"
          style={{ accentColor: '#ffffff' }}
          aria-label={`Seek ${title}`}
        />
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-[#8C7A52]">
          <span>{mmss(Math.floor(currentTime))}</span>
          <span>{mmss(item.durationSec)}</span>
        </div>
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

function SectionNav({ canGoPrevious, onPrevious, onNext, nextLabel = 'Next Section →' }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="rounded-xl border border-[#D4A843]/30 px-4 py-3 font-semibold text-[#E8D5A3] transition-all duration-200 hover:border-[#D4A843] disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Previous Section
      </button>
      <button
        type="button"
        onClick={onNext}
        className="rounded-xl border border-[#D4A843]/60 px-4 py-3 font-semibold text-[#D4A843] transition-all duration-200 hover:bg-[#D4A843] hover:text-[#0F0E0C]"
      >
        {nextLabel}
      </button>
    </div>
  )
}

function AnswerCardPause({ canGoPrevious, onPrevious, onNext }) {
  return (
    <div className="rounded-2xl border border-[#D4A843]/30 bg-[#1A1814] p-8 text-center">
      <h3 className="text-2xl font-bold text-[#D4A843]">Answer Card Fill</h3>
      <p className="mt-2 text-[#8C7A52]">Take a short moment before the reading section begins.</p>
      <SectionNav canGoPrevious={canGoPrevious} onPrevious={onPrevious} onNext={onNext} nextLabel="Continue to Reading" />
    </div>
  )
}

export default function ExamRunner({ exam, onExit, onComplete }) {
  const {
    answers,
    currentSection,
    canGoPrevious,
    progress,
    setAnswer,
    goToPreviousSection,
    goToNextSection,
  } = useExamState()
  const [exitOpen, setExitOpen] = useState(false)
  const [playedParts, setPlayedParts] = useState({})
  const [showBanner, setShowBanner] = useState(true)
  const submittedRef = useRef(false)
  const secondsRef = useRef(exam.totalDurationSeconds)

  const submit = useCallback(() => {
    if (submittedRef.current) return
    submittedRef.current = true
    const durationSeconds = Math.max(0, exam.totalDurationSeconds - secondsRef.current)
    onComplete(answers, { durationSeconds })
  }, [answers, exam.totalDurationSeconds, onComplete])

  const { secondsRemaining, start } = useExamTimer(exam.totalDurationSeconds, submit)

  useEffect(() => {
    secondsRef.current = secondsRemaining
  }, [secondsRemaining])

  useEffect(() => {
    start()
  }, [start])

  useEffect(() => {
    setShowBanner(true)
    const id = window.setTimeout(() => setShowBanner(false), 2000)
    return () => window.clearTimeout(id)
  }, [currentSection])

  const meta = sectionMeta[currentSection]
  const audioKey = meta.audioKey
  const lowTime = secondsRemaining <= 5 * 60

  const sectionNav = (
    <SectionNav
      canGoPrevious={canGoPrevious}
      onPrevious={goToPreviousSection}
      onNext={goToNextSection}
    />
  )

  return (
    <div className="space-y-4 text-[#E8D5A3]">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D4A843]/30 bg-[#1A1814] p-4">
        <div>
          <h2 className="font-bold text-[#D4A843]">HSK {exam.hskLevel} — Exam {exam.examNumber}</h2>
          <p className="text-xs text-[#8C7A52]">{exam.examId}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={['text-xl font-bold tabular-nums text-[#D4A843]', lowTime ? 'animate-pulse text-red-400' : ''].join(' ')}>
            {mmss(secondsRemaining)}
          </span>
          <button type="button" onClick={() => setExitOpen(true)} className="rounded-lg border border-[#D4A843]/40 px-3 py-1 text-sm font-semibold text-[#D4A843] transition-all duration-200 hover:border-[#D4A843]">Stop Exam</button>
        </div>
      </header>
      <div className="h-1 overflow-hidden rounded-full bg-[#1A1814]">
        <div className="h-full bg-[#D4A843]" style={{ width: `${progress.percent}%` }} />
      </div>
      {showBanner ? (
        <div className="animate-[exam-fade_200ms_ease] rounded-2xl border border-[#D4A843]/30 bg-[#D4A843]/10 p-6 text-center text-2xl font-bold text-[#D4A843]">
          {meta.banner}
          <style>{'@keyframes exam-fade { from { opacity: 0; } to { opacity: 1; } }'}</style>
        </div>
      ) : null}
      <main className="animate-[exam-fade_200ms_ease]">
        {audioKey ? (
          <AudioPlayer exam={exam} audioKey={audioKey} title={meta.title} onPlayed={() => setPlayedParts((p) => ({ ...p, [audioKey]: true }))} />
        ) : null}
        {currentSection === 'listening_part1' ? <><ListeningPart1 exam={exam} answers={answers} setAnswer={setAnswer} />{sectionNav}</> : null}
        {currentSection === 'listening_part2' ? <><ListeningPart2 exam={exam} answers={answers} setAnswer={setAnswer} />{sectionNav}</> : null}
        {currentSection === 'listening_part3' ? <><ListeningPart3 exam={exam} answers={answers} setAnswer={setAnswer} />{sectionNav}</> : null}
        {currentSection === 'listening_part4' ? <><ListeningPart4 exam={exam} answers={answers} setAnswer={setAnswer} />{sectionNav}</> : null}
        {currentSection === 'answer_card' ? <AnswerCardPause canGoPrevious={canGoPrevious} onPrevious={goToPreviousSection} onNext={goToNextSection} /> : null}
        {currentSection === 'reading_part1' ? <><ReadingPart1 exam={exam} answers={answers} setAnswer={setAnswer} />{sectionNav}</> : null}
        {currentSection === 'reading_part2' ? <><ReadingPart2 exam={exam} answers={answers} setAnswer={setAnswer} />{sectionNav}</> : null}
        {currentSection === 'reading_part3' ? <><ReadingPart3 exam={exam} answers={answers} setAnswer={setAnswer} />{sectionNav}</> : null}
        {currentSection === 'reading_part4' ? (
          <>
            <ReadingPart4
              exam={exam}
              answers={answers}
              setAnswer={setAnswer}
              onSubmit={() => {
                if (window.confirm('Submit your exam? This cannot be undone.')) submit()
              }}
            />
            <div className="mt-5">
              <button
                type="button"
                onClick={goToPreviousSection}
                className="w-full rounded-xl border border-[#D4A843]/30 px-4 py-3 font-semibold text-[#E8D5A3] transition-all duration-200 hover:border-[#D4A843]"
              >
                ← Previous Section
              </button>
            </div>
          </>
        ) : null}
      </main>
      <ExamExitModal open={exitOpen} onCancel={() => setExitOpen(false)} onExit={onExit} />
    </div>
  )
}
