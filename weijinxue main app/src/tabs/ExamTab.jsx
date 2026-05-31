import { useMemo, useState } from 'react'
import ExamLanding from '../exam/ExamLanding.jsx'
import ExamLevelSelect from '../exam/ExamLevelSelect.jsx'
import ExamNumberSelect from '../exam/ExamNumberSelect.jsx'
import ExamSummary from '../exam/ExamSummary.jsx'
import ExamRunner from '../exam/ExamRunner.jsx'
import ExamResults from '../exam/ExamResults.jsx'
import ExamReview from '../exam/ExamReview.jsx'
import { saveExamAttempt } from '../exam/examAttempts.js'
import { EXAM_REGISTRY } from '../exam/data/examRegistry.js'
import { useAuth } from '../context/useAuth.js'

export default function ExamTab() {
  const { user } = useAuth()
  const levels = useMemo(() => Object.values(EXAM_REGISTRY), [])
  const [screen, setScreen] = useState('landing')
  const [selectedLevel, setSelectedLevel] = useState(null)
  const [selectedExam, setSelectedExam] = useState(null)
  const [resultAnswers, setResultAnswers] = useState(null)
  const [durationSeconds, setDurationSeconds] = useState(0)
  const [runnerKey, setRunnerKey] = useState(0)
  const examData = selectedExam?.data

  const handleTryAgain = () => {
    if (user?.uid && examData && resultAnswers) {
      void saveExamAttempt(user.uid, { exam: examData, answers: resultAnswers, durationSeconds }).catch((err) => {
        console.error('Failed to save exam attempt', err)
      })
    }
    setResultAnswers(null)
    setDurationSeconds(0)
    setRunnerKey((k) => k + 1)
    setScreen('summary')
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 pb-4 text-[#E8D5A3]">
      {screen === 'landing' ? <ExamLanding onMock={() => setScreen('level')} /> : null}

      {screen === 'level' ? (
        <ExamLevelSelect
          levels={levels}
          onBack={() => setScreen('landing')}
          onSelect={(level) => {
            setSelectedLevel(level)
            setScreen('number')
          }}
        />
      ) : null}

      {screen === 'number' && selectedLevel ? (
        <ExamNumberSelect
          level={selectedLevel}
          onBack={() => setScreen('level')}
          onSelect={(exam) => {
            setSelectedExam(exam)
            setScreen('summary')
          }}
        />
      ) : null}

      {screen === 'summary' && examData ? (
        <ExamSummary exam={examData} onBack={() => setScreen('number')} onStart={() => setScreen('runner')} />
      ) : null}

      {screen === 'runner' && examData ? (
        <ExamRunner
          key={`${examData.examId}-${runnerKey}`}
          exam={examData}
          onExit={() => setScreen('summary')}
          onComplete={(answers, meta) => {
            setResultAnswers(answers)
            setDurationSeconds(meta?.durationSeconds ?? 0)
            setScreen('results')
          }}
        />
      ) : null}

      {screen === 'results' && examData && resultAnswers ? (
        <ExamResults
          exam={examData}
          answers={resultAnswers}
          onBack={() => setScreen('landing')}
          onReview={() => setScreen('review')}
          onTryAgain={handleTryAgain}
        />
      ) : null}

      {screen === 'review' && examData && resultAnswers ? (
        <ExamReview
          examData={examData}
          userAnswers={resultAnswers}
          answerKey={examData.answerKey}
          onFinish={() => setScreen('results')}
          onBack={() => setScreen('results')}
        />
      ) : null}
    </div>
  )
}
