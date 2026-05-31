import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { APP_VERSION_LABEL } from '../config/appMeta.js'
import {
  fetchProfileDoc,
  fetchStatsSummary,
  fetchStudyDaysForYear,
} from '../utils/studyStatsFirestore.js'
import {
  activeDaysInYear,
  daysInYear,
  localTodayYMD,
  parseYMD,
} from '../utils/studyDates.js'
import {
  getHskFlashOverview,
  getMasteredFromSavedWords,
} from '../utils/profileLocalStats.js'

function formatJoinDate(isoish) {
  if (!isoish) return '—'
  try {
    const d = new Date(isoish)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

/**
 * Full calendar year heatmap (Sun–Sat columns).
 * @param {number} year
 * @param {Record<string, { cardsStudied?: number, flashcardsRated?: number, reviews?: number, quizAnswered?: number, typedCharacters?: number, typeSessions?: number, studySeconds?: number }>} dayMap
 */
function buildContributionGridYear(year, dayMap) {
  const jan1 = new Date(year, 0, 1)
  const startDay = jan1.getDay()
  /** @type {{ key: string, ymd: string | null, count: number, pad?: boolean }[]} */
  const cells = []
  for (let i = 0; i < startDay; i += 1) {
    cells.push({ key: `pad-${i}`, ymd: null, count: 0, pad: true })
  }
  const end = new Date(year, 11, 31)
  for (let d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const ymd = `${y}-${m}-${day}`
    const v = dayMap[ymd]
    const count = dayStudyIntensity(v)
    cells.push({ key: ymd, ymd, count, pad: false })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `pad-end-${cells.length}`, ymd: null, count: 0, pad: true })
  }
  return cells
}

/** @param {Date} d */
function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Sunday on or before `d` (local). */
function startWeekSunday(d) {
  const x = startOfLocalDay(d)
  x.setDate(x.getDate() - x.getDay())
  return x
}

/** Saturday on or after `d` (local). */
function endWeekSaturday(d) {
  const x = startOfLocalDay(d)
  const dow = x.getDay()
  const add = dow === 6 ? 0 : 6 - dow
  x.setDate(x.getDate() + add)
  return x
}

/**
 * Rolling window ending today, week-aligned (for narrow / compressed layout).
 * @param {number} monthsBack
 * @param {Record<string, { cardsStudied?: number, flashcardsRated?: number, reviews?: number, quizAnswered?: number, typedCharacters?: number, typeSessions?: number, studySeconds?: number }>} dayMap
 */
function buildContributionGridRecentMonths(monthsBack, dayMap) {
  const end = startOfLocalDay(new Date())
  const start = startOfLocalDay(new Date(end))
  start.setMonth(start.getMonth() - monthsBack)

  const gridStart = startWeekSunday(start)
  const gridEnd = endWeekSaturday(end)

  /** @type {{ key: string, ymd: string | null, count: number, pad?: boolean }[]} */
  const cells = []
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const inRange = d >= start && d <= end
    if (!inRange) {
      cells.push({ key: `pad-${ymd}`, ymd: null, count: 0, pad: true })
      continue
    }
    const v = dayMap[ymd]
    const count = dayStudyIntensity(v)
    cells.push({ key: ymd, ymd, count, pad: false })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `pad-end-${cells.length}`, ymd: null, count: 0, pad: true })
  }
  return cells
}

function formatHeatmapTooltip(ymd, count) {
  const d = parseYMD(ymd)
  if (Number.isNaN(d.getTime())) return ''
  const label = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  return `${label} — ${count} reviews`
}

function intensityClass(count) {
  if (count <= 0) return 'bg-[#252219] border border-taupe/40'
  if (count < 5) return 'bg-[#D4A843]/25 border border-[#D4A843]/35'
  if (count < 15) return 'bg-[#D4A843]/45 border border-[#D4A843]/50'
  if (count < 30) return 'bg-[#D4A843]/65 border border-[#D4A843]/60'
  return 'bg-[#D4A843]/85 border border-[#D4A843]/70'
}

function dayStudyIntensity(v) {
  if (!v || typeof v !== 'object') return 0
  return (
    (v.reviews ?? 0) +
    (v.flashcardsRated ?? v.cardsStudied ?? 0) +
    (v.quizAnswered ?? 0) +
    (v.typedCharacters ?? 0) +
    (v.typeSessions ?? 0)
  )
}

const HEATMAP_GAP_PX = 2
const HEATMAP_MIN_CELL = 3
const HEATMAP_MAX_CELL = 10

/** Narrow / mobile: shorter heatmap window so columns fit without horizontal scroll. */
function usePreferSixMonthHeatmap() {
  const q = '(max-width: 640px)'
  const [narrow, setNarrow] = useState(
    () => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false),
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const m = window.matchMedia(q)
    const fn = () => setNarrow(m.matches)
    fn()
    m.addEventListener('change', fn)
    return () => m.removeEventListener('change', fn)
  }, [])
  return narrow
}

/** @param {{ onOpenAuth: () => void }} props */
export default function ProfileTab({ onOpenAuth }) {
  const { user, loading, signOut, updateDisplayName } = useAuth()
  const year = new Date().getFullYear()
  const [summary, setSummary] = useState(null)
  const [dayMap, setDayMap] = useState(/** @type {Record<string, any>} */ ({}))
  const [profileExtra, setProfileExtra] = useState(null)
  const [localTick, setLocalTick] = useState(0)
  const [nameDraft, setNameDraft] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameOk, setNameOk] = useState(false)
  const [editingDisplayName, setEditingDisplayName] = useState(false)
  const nameInputRef = useRef(/** @type {HTMLInputElement | null} */ (null))
  const preferSixMonthHeatmap = usePreferSixMonthHeatmap()
  const heatmapMeasureRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const [heatmapW, setHeatmapW] = useState(0)

  const reloadLocal = useCallback(() => setLocalTick((t) => t + 1), [])

  useEffect(() => {
    const fn = () => reloadLocal()
    window.addEventListener('storage', fn)
    window.addEventListener('huaxue-learned-changed', fn)
    return () => {
      window.removeEventListener('storage', fn)
      window.removeEventListener('huaxue-learned-changed', fn)
    }
  }, [reloadLocal])

  useEffect(() => {
    if (!user?.uid) {
      setSummary(null)
      setDayMap({})
      setProfileExtra(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const [sum, days, prof] = await Promise.all([
          fetchStatsSummary(user.uid),
          fetchStudyDaysForYear(user.uid, year),
          fetchProfileDoc(user.uid),
        ])
        if (cancelled) return
        setSummary(sum)
        setDayMap(days)
        setProfileExtra(prof)
      } catch (e) {
        console.warn('[ProfileTab] load failed', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.uid, user?.displayName, year])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const el = heatmapMeasureRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (typeof w === 'number' && w > 0) setHeatmapW(Math.floor(w))
    })
    ro.observe(el)
    queueMicrotask(() => {
      const w = el.clientWidth
      if (w > 0) setHeatmapW(Math.floor(w))
    })
    return () => ro.disconnect()
  }, [user?.uid, loading, preferSixMonthHeatmap, year, dayMap])

  useEffect(() => {
    setNameDraft(user?.displayName?.trim() ?? '')
    setNameError('')
    setNameOk(false)
    setEditingDisplayName(false)
  }, [user?.uid])

  useEffect(() => {
    setNameDraft(user?.displayName?.trim() ?? '')
  }, [user?.displayName])

  useEffect(() => {
    if (!editingDisplayName) return
    const id = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(id)
  }, [editingDisplayName])

  const handleSaveDisplayName = useCallback(async () => {
    if (!user) return
    setNameError('')
    setNameOk(false)
    setNameSaving(true)
    try {
      await updateDisplayName(nameDraft)
      setEditingDisplayName(false)
      setNameOk(true)
      window.setTimeout(() => setNameOk(false), 2500)
    } catch (e) {
      setNameError(typeof e?.message === 'string' ? e.message : 'Could not update display name.')
    } finally {
      setNameSaving(false)
    }
  }, [user, nameDraft, updateDisplayName])

  const handleCancelDisplayNameEdit = useCallback(() => {
    setNameDraft(user?.displayName?.trim() ?? '')
    setNameError('')
    setEditingDisplayName(false)
  }, [user?.displayName])

  const nameDirty = nameDraft.trim() !== (user?.displayName?.trim() ?? '')
  const displayNameLabel = user?.displayName?.trim() ?? ''
  const editDisplayNameCta = displayNameLabel ? 'Edit' : 'Add name'

  const hskRows = useMemo(() => {
    void localTick
    return [1, 2, 3, 4, 5, 6].map((lv) => ({
      level: lv,
      label: `HSK ${lv}`,
      ...getHskFlashOverview(lv),
    }))
  }, [localTick])

  const savedMastered = useMemo(() => {
    void localTick
    return getMasteredFromSavedWords()
  }, [localTick])

  const todayYmd = localTodayYMD()
  const todayCell = dayMap[todayYmd]
  const todayTotal = dayStudyIntensity(todayCell)

  const gridFullYear = useMemo(() => buildContributionGridYear(year, dayMap), [year, dayMap])
  const gridSixMo = useMemo(() => buildContributionGridRecentMonths(6, dayMap), [dayMap])
  const heatmapGrid = preferSixMonthHeatmap ? gridSixMo : gridFullYear
  const heatmapTitleLabel = preferSixMonthHeatmap ? 'Last 6 months' : String(year)

  const weekCount = Math.max(1, Math.ceil(heatmapGrid.length / 7))
  const heatmapCellPx = useMemo(() => {
    if (heatmapW <= 0) return 8
    const raw = Math.floor((heatmapW - HEATMAP_GAP_PX * Math.max(0, weekCount - 1)) / weekCount)
    return Math.max(HEATMAP_MIN_CELL, Math.min(HEATMAP_MAX_CELL, raw))
  }, [heatmapW, weekCount])

  const activeDays = useMemo(() => activeDaysInYear(dayMap, year), [dayMap, year])
  const yearLen = daysInYear(year)
  const daysLearnedPct = yearLen > 0 ? Math.round((activeDays / yearLen) * 100) : 0

  const totalReviewsEver = summary
    ? (summary.totalReviews ?? 0) +
      (summary.totalFlashcardsRated ?? 0) +
      (summary.totalQuizAnswered ?? 0) +
      (summary.totalTypedCharacters ?? 0)
    : 0
  const dailyAvg =
    activeDays > 0 ? Math.round(totalReviewsEver / Math.max(1, activeDays)) : 0

  const quizAccuracy = summary
    ? summary.totalQuizAnswered > 0
      ? Math.round((summary.totalQuizCorrect / summary.totalQuizAnswered) * 100)
      : 0
    : 0

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted">
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-10 text-center">
        <h2 id="profile-heading" className="text-lg font-semibold text-[#D4A843]">
          Profile &amp; stats
        </h2>
        <p className="text-sm leading-relaxed text-espresso">
          Sign in to track your progress, streaks, and study history.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="rounded-xl bg-[#D4A843] px-5 py-2.5 text-sm font-semibold text-[#111] transition hover:brightness-110"
        >
          Sign In
        </button>
      </div>
    )
  }

  const creationTime = user.metadata?.creationTime
    ? formatJoinDate(user.metadata.creationTime)
    : formatJoinDate(profileExtra?.createdAt?.toDate?.() ?? profileExtra?.createdAt)
  const providerLabel =
    profileExtra?.provider ||
    (user.providerData[0]?.providerId === 'google.com'
      ? 'Google'
      : user.providerData[0]?.providerId === 'password'
        ? 'Email'
        : '—')

  const hasCloudActivity =
    summary &&
    ((summary.totalReviews ?? 0) > 0 ||
      (summary.totalFlashcardsRated ?? 0) > 0 ||
      (summary.totalQuizAnswered ?? 0) > 0 ||
      (summary.totalTypedCharacters ?? 0) > 0 ||
      (summary.totalTypeSessions ?? 0) > 0 ||
      (summary.totalStudySeconds ?? 0) > 0)

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 pb-4 text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="profile-heading" className="text-base font-semibold tracking-wide text-[#D4A843]">
          Profile &amp; stats
        </h2>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-lg border border-taupe px-3 py-1.5 text-[11px] font-medium text-espresso transition hover:border-[#D4A843]/50 hover:text-[#D4A843]"
        >
          Sign out
        </button>
      </div>

      {!hasCloudActivity ? (
        <p className="text-center text-xs text-muted">
          Start studying to build your streak. Stats sync when you&apos;re signed in.
        </p>
      ) : null}

      {/* Account */}
      <section className="rounded-2xl border border-taupe bg-[#1c1a16] p-4 shadow-sm ring-1 ring-[#D4A843]/10 sm:p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Account</h3>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wide text-muted">Display name</p>
            {editingDisplayName ? (
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={128}
                  disabled={nameSaving}
                  autoComplete="name"
                  placeholder="How we greet you in the app"
                  className="min-w-0 flex-1 rounded-lg border border-taupe bg-paper px-3 py-2 text-sm text-ink outline-none ring-[#D4A843]/25 focus:ring-2"
                  aria-label="Display name"
                />
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveDisplayName()}
                    disabled={nameSaving || !nameDirty}
                    className="rounded-lg border border-[#D4A843]/60 bg-[#D4A843]/15 px-4 py-2 text-xs font-semibold text-[#D4A843] transition enabled:hover:bg-[#D4A843]/25 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {nameSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelDisplayNameEdit}
                    disabled={nameSaving}
                    className="rounded-lg border border-taupe px-4 py-2 text-xs font-medium text-espresso transition enabled:hover:border-[#D4A843]/40 enabled:hover:text-[#D4A843] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <p className="min-w-0 flex-1 break-words text-ink">
                  {displayNameLabel ? displayNameLabel : <span className="text-muted">Not set — tap Edit to add one</span>}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(user?.displayName?.trim() ?? '')
                    setNameError('')
                    setNameOk(false)
                    setEditingDisplayName(true)
                  }}
                  className="shrink-0 self-start rounded-lg border border-taupe px-3 py-1.5 text-[11px] font-medium text-espresso transition hover:border-[#D4A843]/50 hover:text-[#D4A843]"
                >
                  {editDisplayNameCta}
                </button>
              </div>
            )}
            {nameError ? <p className="mt-1 text-xs text-wrong">{nameError}</p> : null}
            {nameOk && !editingDisplayName ? (
              <p className="mt-1 text-xs text-correct">Display name updated.</p>
            ) : null}
            <p className="mt-1.5 text-[10px] text-muted">Shown on your account only — not shared in study stats.</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">Email</p>
            <p className="break-all text-espresso">{user.email ? user.email : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">Joined</p>
            <p className="text-espresso">{creationTime}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">Sign-in</p>
            <p className="text-espresso">{providerLabel}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted">App version</p>
            <p className="tabular-nums text-espresso">{APP_VERSION_LABEL}</p>
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <section className="rounded-2xl border border-taupe bg-[#1c1a16] p-4 shadow-sm ring-1 ring-[#D4A843]/10 sm:p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Quick stats
        </h3>
        <p className="mt-2 text-[10px] text-muted">
          Cloud totals when signed in. Saved words are counted on this device.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="Reviews today" value={todayTotal} />
          <Stat label="Current streak" value={`${summary?.currentStreak ?? 0} days`} />
          <Stat label="Longest streak" value={`${summary?.longestStreak ?? 0} days`} />
          <Stat label="Quiz accuracy" value={`${quizAccuracy}%`} />
          <Stat label="Saved words" value={savedMastered} />
          <Stat label="Characters typed" value={summary?.totalTypedCharacters ?? 0} />
        </div>
      </section>

      {/* Heatmap */}
      <section className="rounded-2xl border border-taupe bg-[#1c1a16] p-4 shadow-sm ring-1 ring-[#D4A843]/10 sm:p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Study activity · {heatmapTitleLabel}
        </h3>
        <div
          ref={heatmapMeasureRef}
          className="mt-3 w-full min-w-0 overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-full justify-center overflow-hidden">
            <div
              className="inline-grid"
              style={{
                gridTemplateRows: `repeat(7, ${heatmapCellPx}px)`,
                gridAutoFlow: 'column',
                gridAutoColumns: `${heatmapCellPx}px`,
                gap: `${HEATMAP_GAP_PX}px`,
              }}
              role="img"
              aria-label={`Study heatmap, ${heatmapTitleLabel}`}
            >
              {heatmapGrid.map((c) =>
                c.pad ? (
                  <span key={c.key} className="min-h-[3px] min-w-[3px] rounded-[1px] bg-transparent" aria-hidden />
                ) : (
                  <span
                    key={c.key}
                    title={c.ymd ? formatHeatmapTooltip(c.ymd, c.count) : ''}
                    className={['block min-h-0 min-w-0 rounded-[2px]', intensityClass(c.count)].join(' ')}
                  />
                ),
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-[11px] text-espresso sm:grid-cols-2">
          <p>
            <span className="text-muted">Daily average: </span>
            <span className="font-medium text-ink tabular-nums">{dailyAvg}</span> reviews
          </p>
          <p>
            <span className="text-muted">Days learned: </span>
            <span className="font-medium text-ink tabular-nums">{daysLearnedPct}%</span>
          </p>
        </div>
      </section>

      {/* HSK deck-style table */}
      <section className="rounded-2xl border border-taupe bg-[#1c1a16] p-4 shadow-sm ring-1 ring-[#D4A843]/10 sm:p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          HSK overview (flashcards, this device)
        </h3>
        <p className="mt-1 text-[10px] text-muted">
          {/* TODO: merge quiz SR due counts and cloud deck when available */}
          New = never rated · Learning = in progress · Due = not yet mastered
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-taupe text-[10px] uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">HSK level</th>
                <th className="py-2 pr-3 font-medium tabular-nums">New</th>
                <th className="py-2 pr-3 font-medium tabular-nums">Learning</th>
                <th className="py-2 pr-3 font-medium tabular-nums">Due</th>
                <th className="py-2 font-medium tabular-nums">Mastered</th>
              </tr>
            </thead>
            <tbody>
              {hskRows.map((r) => (
                <tr key={r.level} className="border-b border-taupe/60 text-espresso">
                  <td className="py-2 pr-3 font-medium text-ink">{r.label}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.new}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.learning}</td>
                  <td className="py-2 pr-3 tabular-nums text-[#D4A843]/90">{r.due}</td>
                  <td className="py-2 tabular-nums text-correct">{r.mastered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

/** @param {{ label: string, value: string | number }} props */
function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-taupe/50 bg-[#0f0e0c]/80 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
    </div>
  )
}
