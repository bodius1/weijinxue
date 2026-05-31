import { useEffect, useMemo, useState } from 'react'
import { fetchExamAttempts, formatAttemptDate } from './examAttempts.js'
import { useAuth } from '../context/useAuth.js'

const row = (label, value) => (
  <div className="flex justify-between gap-4 border-b border-[#D4A843]/15 py-2 last:border-b-0">
    <span className="text-[#8C7A52]">{label}</span>
    <span className="text-right text-[#E8D5A3]">{value}</span>
  </div>
)

function AttemptHistory({ examId }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [attempts, setAttempts] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false)
      setAttempts([])
      return undefined
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const limit = showAll ? 50 : 6
        const data = await fetchExamAttempts(user.uid, examId, limit)
        if (!cancelled) {
          setHasMore(!showAll && data.length > 5)
          setAttempts(showAll ? data : data.slice(0, 5))
        }
      } catch (err) {
        console.error('Failed to load exam attempts', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.uid, examId, showAll])

  if (!user) {
    return <p className="text-sm text-[#8C7A52]">🔒 Sign in to track your attempt history</p>
  }

  if (loading) {
    return <p className="text-sm text-[#8C7A52]">Loading attempts...</p>
  }

  if (attempts.length === 0) {
    return <p className="text-sm text-[#8C7A52]">No attempts yet — take the exam to begin tracking.</p>
  }

  const best = attempts.reduce((max, a) => {
    const t = a.score?.total ?? 0
    return t > (max?.score?.total ?? 0) ? a : max
  }, attempts[0])

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[#D4A843]">📊 Your Previous Attempts</p>
      <div className="overflow-x-auto text-sm">
        <table className="w-full min-w-[280px] border-collapse">
          <thead>
            <tr className="border-b border-[#D4A843]/20 text-left text-[#8C7A52]">
              <th className="py-1 pr-3 font-medium">Attempt</th>
              <th className="py-1 pr-3 font-medium">Date</th>
              <th className="py-1 pr-3 font-medium">Score</th>
              <th className="py-1 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a, i) => {
              const attemptNum = attempts.length - i
              const total = a.score?.total ?? 0
              const passed = a.score?.passed ?? total >= 24
              return (
                <tr key={a.id} className="border-b border-[#D4A843]/10 last:border-b-0">
                  <td className="py-2 pr-3 text-[#E8D5A3]">#{attemptNum}</td>
                  <td className="py-2 pr-3 text-[#8C7A52]">{formatAttemptDate(a.attemptedAt)}</td>
                  <td className="py-2 pr-3 font-semibold text-[#D4A843]">{total}/40</td>
                  <td className={['py-2 font-medium', passed ? 'text-green-400' : 'text-red-400'].join(' ')}>
                    {passed ? '✅ Pass' : '❌ Try Again'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hasMore && !showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs font-semibold text-[#D4A843] transition-all duration-200 hover:text-[#E8D5A3]"
        >
          View All Attempts
        </button>
      ) : null}
      {attempts.length > 1 && best?.score ? (
        <p className="text-xs text-[#8C7A52]">
          🏆 Best: {best.score.total}/40 ({best.score.percent}%)
        </p>
      ) : null}
    </div>
  )
}

export default function ExamSummary({ exam, onBack, onStart }) {
  const examId = useMemo(() => exam.examId, [exam.examId])

  return (
    <section className="rounded-3xl border border-[#D4A843]/30 bg-[#1A1814] p-5 text-[#E8D5A3]">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-[#D4A843] transition-all duration-200 hover:text-[#E8D5A3]">
        ← Back
      </button>
      <div className="mt-4 text-center">
        <h2 className="text-2xl font-bold text-[#D4A843]">{exam.title}</h2>
        <p className="text-sm text-[#8C7A52]">{exam.examId}</p>
      </div>
      <div className="mt-6 rounded-2xl border border-[#D4A843]/30 bg-[#0F0E0C] p-4">
        <h3 className="font-semibold text-[#D4A843]">Exam Overview</h3>
        <div className="mt-3 text-sm">
          {row('Total Duration', '~40 minutes')}
          {row('Listening Section', '~15 minutes (20 Qs)')}
          {row('Answer Card Fill', '3 minutes')}
          {row('Reading Section', '17 minutes (20 Qs)')}
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#D4A843]/30 bg-[#0F0E0C] p-4">
          <h3 className="font-semibold text-[#D4A843]">Listening (一、听力) — 20 Questions</h3>
          <ul className="mt-3 space-y-2 text-sm text-[#E8D5A3]">
            <li>Part 1 (Q1-5): True/False — does audio match image?</li>
            <li>Part 2 (Q6-10): Choose the correct image (A/B/C)</li>
            <li>Part 3 (Q11-15): Match image to short conversation</li>
            <li>Part 4 (Q16-20): Multiple choice text answers</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-[#D4A843]/30 bg-[#0F0E0C] p-4">
          <h3 className="font-semibold text-[#D4A843]">Reading (二、阅读) — 20 Questions</h3>
          <ul className="mt-3 space-y-2 text-sm text-[#E8D5A3]">
            <li>Part 1 (Q21-25): Does word match image? (yes/no)</li>
            <li>Part 2 (Q26-30): Match sentence to image (A-F)</li>
            <li>Part 3 (Q31-35): Match question to answer (A-F)</li>
            <li>Part 4 (Q36-40): Fill in the blank (choose A-F)</li>
          </ul>
        </div>
      </div>
      <div className="mt-5 rounded-lg border border-[#D4A843]/20 bg-[#111111] p-3">
        <AttemptHistory examId={examId} />
      </div>
      <p className="mt-5 rounded-2xl border border-[#D4A843]/30 bg-[#0F0E0C] p-4 text-sm text-[#8C7A52]">
        Once started, the exam timer cannot be paused. Exiting will forfeit your current attempt.
      </p>
      <button
        type="button"
        onClick={onStart}
        className="mt-5 w-full rounded-2xl border border-[#D4A843] bg-[#D4A843]/15 px-5 py-4 text-lg font-bold text-[#D4A843] transition-all duration-200 hover:bg-[#D4A843] hover:text-[#0F0E0C]"
      >
        START 开始
      </button>
    </section>
  )
}
