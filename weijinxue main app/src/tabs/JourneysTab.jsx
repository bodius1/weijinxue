import { useCallback, useMemo, useState } from 'react'
import { timeDateContextPack } from '../journeys/data/contextPacks/timeDate.js'
import ContextProgressRing from '../journeys/components/ContextProgressRing.jsx'
import JourneyCard from '../journeys/components/JourneyCard.jsx'
import JourneyMap from '../journeys/components/JourneyMap.jsx'
import LessonNode from '../journeys/components/LessonNode.jsx'
import { getStageById } from '../journeys/engine/contextPackSchema.js'
import { useContextProgress } from '../journeys/hooks/useContextProgress.js'

/** Placeholder journeys for the home grid (not yet implemented). */
const PLACEHOLDER_JOURNEYS = [
  {
    id: 'hotel-lobby',
    title: 'Hotel Lobby',
    chineseTitle: '饭店前台',
    description: 'Check in, ask about breakfast, and handle simple requests at the front desk.',
    stageCount: 6,
    progressPercent: 25,
    comingSoon: true,
    locked: false,
  },
  {
    id: 'ordering-food',
    title: 'Ordering Food',
    chineseTitle: '点菜',
    description: 'Order dishes, ask about spice level, and pay the bill.',
    stageCount: 6,
    locked: true,
  },
  {
    id: 'directions',
    title: 'Directions',
    chineseTitle: '问路',
    description: 'Ask where places are and understand simple directions.',
    stageCount: 5,
    locked: true,
  },
  {
    id: 'shopping',
    title: 'Shopping',
    chineseTitle: '买东西',
    description: 'Prices, sizes, and paying at a market or shop.',
    stageCount: 5,
    locked: true,
  },
]

export default function JourneysTab() {
  const pack = timeDateContextPack
  const {
    progress,
    activeStageId,
    activeStage,
    unlockedStageIds,
    completedStageIds,
    stageStats,
    recordDrillAttempt,
    setActiveStage,
  } = useContextProgress(pack)

  const [screen, setScreen] = useState(/** @type {'home' | 'roadmap' | 'lesson'} */ ('home'))
  const [lessonStageId, setLessonStageId] = useState(/** @type {string | null} */ (null))
  const [lockedHint, setLockedHint] = useState(/** @type {string | null} */ (null))

  const totalStages = pack.stages.length
  const completedCount = completedStageIds.length
  const progressPercent = Math.round((completedCount / totalStages) * 100)

  const continueStage = activeStage ?? (activeStageId ? getStageById(pack, activeStageId) : null)

  const lessonStage = useMemo(() => {
    if (!lessonStageId) return null
    return getStageById(pack, lessonStageId) ?? null
  }, [lessonStageId, pack])

  const openRoadmap = useCallback(() => {
    setLockedHint(null)
    setScreen('roadmap')
  }, [])

  const openLesson = useCallback(
    (stageId) => {
      if (!unlockedStageIds.includes(stageId)) return
      setLockedHint(null)
      setLessonStageId(stageId)
      try {
        setActiveStage(stageId)
      } catch {
        /* stage not unlocked — should not happen */
      }
      setScreen('lesson')
    },
    [setActiveStage, unlockedStageIds],
  )

  const handleSelectStage = useCallback(
    (stageId, state) => {
      if (state === 'locked') {
        const stage = getStageById(pack, stageId)
        setLockedHint(
          stage
            ? `Complete earlier stages to unlock “${stage.title}”.`
            : 'Complete earlier stages to unlock this lesson.',
        )
        return
      }
      openLesson(stageId)
    },
    [openLesson, pack],
  )

  const handleContinue = useCallback(() => {
    if (activeStageId && unlockedStageIds.includes(activeStageId)) {
      openLesson(activeStageId)
      return
    }
    openRoadmap()
  }, [activeStageId, openLesson, openRoadmap, unlockedStageIds])

  if (screen === 'lesson' && lessonStage) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 text-[#E8D5A3]">
        <LessonNode
          contextPack={pack}
          stage={lessonStage}
          progress={progress}
          stageStats={stageStats[lessonStage.id] ?? null}
          onRecordDrillAttempt={recordDrillAttempt}
          onBack={() => {
            setScreen('roadmap')
            setLessonStageId(null)
          }}
        />
      </div>
    )
  }

  if (screen === 'roadmap') {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 pb-8 text-[#E8D5A3]">
        <button
          type="button"
          onClick={() => {
            setScreen('home')
            setLockedHint(null)
            setLessonStageId(null)
          }}
          className="text-sm text-[#D4A843] hover:underline"
        >
          ← All journeys
        </button>

        <div className="flex flex-wrap items-center gap-4">
          <ContextProgressRing
            completedCount={completedCount}
            totalCount={totalStages}
            size={64}
          />
          <div>
            <p className="text-xs uppercase tracking-wider text-[#D4A843]/70">Your progress</p>
            <p className="text-sm text-[#E8D5A3]/80">
              {completedCount} of {totalStages} stages complete
            </p>
          </div>
        </div>

        <JourneyMap
          pack={pack}
          unlockedStageIds={unlockedStageIds}
          completedStageIds={completedStageIds}
          activeStageId={activeStageId}
          selectedStageId={lessonStageId}
          onSelectStage={handleSelectStage}
          lockedHint={lockedHint}
        />

        {activeStageId && unlockedStageIds.includes(activeStageId) ? (
          <button
            type="button"
            onClick={() => openLesson(activeStageId)}
            className="w-full rounded-xl bg-[#D4A843] px-4 py-3 text-sm font-semibold text-[#0F0E0C] transition hover:brightness-110"
          >
            Continue current stage
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-8 pb-8 text-[#E8D5A3]">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-[#D4A843] sm:text-2xl">Journeys</h1>
        <p className="text-sm text-[#E8D5A3]/75">
          Practice Mandarin by situation — not just by HSK level.
        </p>
      </header>

      {continueStage ? (
        <section
          className="rounded-xl border border-[#D4A843]/40 bg-gradient-to-br from-[#1A1814] to-[#0F0E0C] p-5 shadow-lg shadow-black/20"
          aria-labelledby="continue-learning-heading"
        >
          <h2 id="continue-learning-heading" className="text-xs font-medium uppercase tracking-wider text-[#D4A843]">
            Continue learning
          </h2>
          <p className="mt-2 text-base font-medium text-[#E8D5A3]">
            {pack.title} — {continueStage.title}
          </p>
          {pack.chineseTitle ? (
            <p className="text-sm text-[#D4A843]/85">{pack.chineseTitle}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <ContextProgressRing
              completedCount={completedCount}
              totalCount={totalStages}
              size={48}
            />
            <button
              type="button"
              onClick={handleContinue}
              className="rounded-xl bg-[#D4A843] px-5 py-2.5 text-sm font-semibold text-[#0F0E0C] transition hover:brightness-110"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={openRoadmap}
              className="rounded-xl border border-[#D4A843]/35 px-4 py-2.5 text-sm text-[#E8D5A3] transition hover:border-[#D4A843]/55"
            >
              View roadmap
            </button>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="situational-journeys-heading">
        <h2
          id="situational-journeys-heading"
          className="mb-4 text-xs font-medium uppercase tracking-wider text-[#D4A843]/80"
        >
          Situational journeys
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <JourneyCard
            title={pack.title}
            chineseTitle={pack.chineseTitle}
            description={pack.description}
            stageCount={totalStages}
            progressPercent={progressPercent}
            completedStages={completedCount}
            onClick={openRoadmap}
          />
          {PLACEHOLDER_JOURNEYS.map((j) => (
            <JourneyCard
              key={j.id}
              title={j.title}
              chineseTitle={j.chineseTitle}
              description={j.description}
              stageCount={j.stageCount}
              progressPercent={j.progressPercent ?? 0}
              locked={j.locked}
              comingSoon={j.comingSoon}
            />
          ))}
        </div>
      </section>

      {progress ? (
        <p className="text-center text-[10px] text-[#E8D5A3]/40" aria-hidden>
          Progress saved on this device
        </p>
      ) : null}
    </div>
  )
}
