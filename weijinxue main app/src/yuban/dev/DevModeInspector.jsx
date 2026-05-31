import { useState } from 'react'
import { useDevMode } from './useDevMode.js'
import { buildEvalCase } from './buildEvalCase.js'
import { formatTimingBreakdownLines } from './storyBeatTiming.js'
import { LazyJsonBlock } from './LazyJsonBlock.jsx'

/**
 * @param {{
 *   section: 'beat' | 'voices',
 *   debugRecord: import('./TurnDebugRecord.js').TurnDebugRecord | null,
 *   currentTurn?: import('../conversation/turnTypes.js').StoryBeatTurn | null,
 *   state?: import('../StoryStateContext.jsx').YubanStoryState | null,
 *   replayGradeLoading?: boolean,
 *   onReplayGrade?: (opts: { useCapturedPrompt?: boolean }) => void | Promise<void>,
 * }} props
 */
export function DevModeInspector({
  section,
  debugRecord,
  currentTurn,
  state,
  replayGradeLoading = false,
  onReplayGrade,
}) {
  const { enabled, panelVisible } = useDevMode()
  const [expanded, setExpanded] = useState(/** @type {Record<string, boolean>} */ ({}))
  const [useCapturedPrompt, setUseCapturedPrompt] = useState(false)

  if (!enabled || !panelVisible) return null
  if (!debugRecord) return null

  const isBeat = section === 'beat'
  const prompt = isBeat ? debugRecord.beatPrompt : debugRecord.voicesPrompt
  const raw = isBeat ? debugRecord.beatRaw : debugRecord.voicesRaw
  const parsed = isBeat ? debugRecord.beatParsed : debugRecord.voicesParsed
  const normalized = isBeat ? null : debugRecord.voicesNormalized
  const duration = isBeat ? debugRecord.beatDurationMs : debugRecord.voicesDurationMs
  const hasReplay = !isBeat && Boolean(debugRecord.voicesReplayAt)
  const original = debugRecord.originalVoices

  if (!prompt && !raw && !hasReplay) return null

  const toggle = (key) => setExpanded((e) => ({ ...e, [key]: !e[key] }))

  const copy = (text) => {
    if (!text) return
    void navigator.clipboard?.writeText(text)
  }

  const formatTs = (ts) => {
    if (!ts) return ''
    try {
      return new Date(ts).toLocaleTimeString()
    } catch {
      return String(ts)
    }
  }

  const handleCopyEvalCase = () => {
    if (!currentTurn || !state) return
    const evalCase = buildEvalCase({ currentTurn, state, debugRecord })
    void navigator.clipboard?.writeText(JSON.stringify(evalCase, null, 2))
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-purple-500/30 bg-purple-950/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wider text-purple-400">
          🔬 {isBeat ? 'Story Beat' : 'Three Voices'} Debug
          {hasReplay ? <span className="ml-1 normal-case text-purple-300/80">(replay)</span> : null}
        </div>
        <div className="shrink-0 text-right text-[10px] text-purple-400/60">
          {replayGradeLoading ? (
            <span className="text-purple-300">Replaying…</span>
          ) : (
            <>
              {debugRecord.storyBeatTiming?.totalContinueToVisibleMs != null
                ? `${debugRecord.storyBeatTiming.totalContinueToVisibleMs}ms`
                : duration != null
                  ? `${duration}ms`
                  : 'pending...'}
              {hasReplay && debugRecord.voicesReplayAt ? (
                <div>Replayed {formatTs(debugRecord.voicesReplayAt)}</div>
              ) : debugRecord.voicesGradedAt ? (
                <div>Graded {formatTs(debugRecord.voicesGradedAt)}</div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {!isBeat && onReplayGrade ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-purple-500/20 pb-2">
          <button
            type="button"
            disabled={replayGradeLoading || !debugRecord.studentReplyRaw}
            onClick={() => void onReplayGrade({ useCapturedPrompt })}
            className="rounded-md border border-purple-500/50 bg-purple-500/15 px-2.5 py-1 text-[11px] font-medium text-purple-200 transition hover:bg-purple-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Replay grade
          </button>
          <button
            type="button"
            disabled={!currentTurn || !debugRecord.studentReplyRaw}
            onClick={handleCopyEvalCase}
            className="rounded-md border border-purple-500/30 px-2.5 py-1 text-[11px] text-purple-300/90 transition hover:bg-purple-500/10 disabled:opacity-40"
          >
            Copy eval case
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-purple-300/80">
            <input
              type="checkbox"
              checked={useCapturedPrompt}
              onChange={(e) => setUseCapturedPrompt(e.target.checked)}
              className="rounded border-purple-500/50"
            />
            Reuse captured prompt
          </label>
        </div>
      ) : null}

      {!isBeat && debugRecord.gradingSource ? (
        <div className="rounded border border-emerald-500/35 bg-emerald-950/20 px-2 py-1.5 font-mono text-[10px] text-emerald-200/90">
          <div>
            Grading source: <span className="text-emerald-300">{debugRecord.gradingSource}</span>
          </div>
          {debugRecord.tokensSavedEstimate != null && debugRecord.tokensSavedEstimate > 0 ? (
            <div>
              Tokens saved estimate: ~{debugRecord.tokensSavedEstimate} tokens
            </div>
          ) : null}
        </div>
      ) : null}

      {isBeat && debugRecord.storyBeatSource ? (
        <div className="rounded border border-emerald-500/35 bg-emerald-950/20 px-2 py-1.5 font-mono text-[10px] text-emerald-200/90">
          Story beat source: <span className="text-emerald-300">{debugRecord.storyBeatSource}</span>
        </div>
      ) : null}

      {!isBeat && debugRecord.voicesReplayError ? (
        <div className="rounded border border-red-500/40 bg-red-950/30 px-2 py-1.5 text-[11px] text-red-300">
          Replay failed: {debugRecord.voicesReplayError}
        </div>
      ) : null}

      {isBeat && debugRecord.storyBeatTiming ? (
        <div className="rounded border border-amber-500/35 bg-amber-950/15 p-2">
          <p className="text-[11px] font-medium text-amber-300">Timing breakdown</p>
          <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-amber-200/90">
            {formatTimingBreakdownLines(debugRecord.storyBeatTiming).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {isBeat && debugRecord.weaknessProfileSnapshot ? (
        <LazyJsonBlock
          label="Weakness profile injected"
          value={debugRecord.weaknessProfileSnapshot}
          highlight="amber"
          onCopy={() => copy(debugRecord.weaknessProfileSnapshot ?? '')}
        />
      ) : null}

      {!isBeat ? (
        <>
          <Block label={`Student reply: "${debugRecord.studentReplyRaw ?? ''}"`} content={null} inline />
          <Block
            label={`Confidence: ${debugRecord.confidenceLevel || '(none)'}`}
            content={null}
            inline
          />
          {debugRecord.learnerProfileSnapshot ? (
            <Block
              label="Learner profile (in prompt)"
              content={debugRecord.learnerProfileSnapshot}
              expanded={expanded.learner}
              onToggle={() => toggle('learner')}
              onCopy={() => copy(debugRecord.learnerProfileSnapshot)}
            />
          ) : null}
        </>
      ) : null}

      <LazyJsonBlock
        label={hasReplay && !useCapturedPrompt ? 'System prompt sent (latest replay)' : 'System prompt sent'}
        value={prompt}
        onCopy={() => copy(prompt ?? '')}
      />

      <LazyJsonBlock
        label={hasReplay ? 'Raw model response (latest replay)' : 'Raw model response'}
        value={raw}
        onCopy={() => copy(raw ?? '')}
      />

      {parsed ? (
        <LazyJsonBlock
          label={hasReplay ? 'Parsed JSON — latest replay' : 'Parsed JSON (raw)'}
          value={parsed}
          onCopy={() => copy(JSON.stringify(parsed, null, 2))}
        />
      ) : null}

      {!isBeat && normalized ? (
        <LazyJsonBlock
          label={hasReplay ? 'Normalized grading — latest replay' : 'Normalized grading (app)'}
          value={normalized}
          highlight="amber"
          onCopy={() => copy(JSON.stringify(normalized, null, 2))}
        />
      ) : null}

      {!isBeat && hasReplay && original ? (
        <SnapshotSection
          title="Original grade"
          snapshot={original}
          expanded={expanded.original}
          onToggle={() => toggle('original')}
          copy={copy}
        />
      ) : null}
    </div>
  )
}

/**
 * @param {{
 *   title: string,
 *   snapshot: import('./TurnDebugRecord.js').VoicesGradeSnapshot,
 *   expanded?: boolean,
 *   onToggle: () => void,
 *   copy: (text: string) => void,
 * }} props
 */
function SnapshotSection({ title, snapshot, expanded, onToggle, copy }) {
  return (
    <div className="rounded border border-purple-500/25 bg-black/20">
      <div
        className="flex cursor-pointer items-center justify-between px-2 py-1.5 hover:bg-white/5"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onToggle()
        }}
      >
        <span className="text-[11px] font-medium text-purple-300/90">
          {expanded ? '▼' : '▶'} {title}
          {snapshot.durationMs != null ? (
            <span className="ml-2 font-normal text-purple-400/50">{snapshot.durationMs}ms</span>
          ) : null}
        </span>
      </div>
      {expanded ? (
        <div className="space-y-1 border-t border-purple-500/15 p-2">
          <MiniBlock label="Prompt" text={snapshot.prompt} onCopy={() => copy(snapshot.prompt ?? '')} />
          <MiniBlock label="Raw" text={snapshot.raw} onCopy={() => copy(snapshot.raw ?? '')} />
          <MiniBlock
            label="Parsed"
            text={snapshot.parsed ? JSON.stringify(snapshot.parsed, null, 2) : ''}
            onCopy={() => copy(JSON.stringify(snapshot.parsed, null, 2))}
          />
          <MiniBlock
            label="Normalized"
            text={snapshot.normalized ? JSON.stringify(snapshot.normalized, null, 2) : ''}
            onCopy={() => copy(JSON.stringify(snapshot.normalized, null, 2))}
          />
        </div>
      ) : null}
    </div>
  )
}

/** @param {{ label: string, text: string | null, onCopy: () => void }} props */
function MiniBlock({ label, text, onCopy }) {
  if (!text) return null
  return (
    <div className="rounded border border-purple-500/10 bg-black/25">
      <div className="flex items-center justify-between px-2 py-0.5">
        <span className="text-[10px] font-medium text-purple-400/70">{label}</span>
        <button type="button" onClick={onCopy} className="text-[9px] text-purple-400/50 hover:text-purple-300">
          copy
        </button>
      </div>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words px-2 pb-1.5 font-mono text-[9px] text-purple-200/90">
        {text}
      </pre>
    </div>
  )
}

/**
 * @param {{
 *   label: string,
 *   content: string | null,
 *   expanded?: boolean,
 *   onToggle?: () => void,
 *   onCopy?: () => void,
 *   inline?: boolean,
 *   highlight?: 'amber',
 * }} props
 */
function Block({ label, content, expanded, onToggle, onCopy, inline, highlight }) {
  if (inline) {
    return (
      <div className="border-l border-purple-500/30 pl-2 font-mono text-[11px] text-purple-300/80">{label}</div>
    )
  }

  const bgClass = highlight === 'amber' ? 'border-amber-500/30 bg-amber-950/20' : 'border-purple-500/20 bg-black/30'

  return (
    <div className={`rounded border ${bgClass}`}>
      <div
        className="flex cursor-pointer items-center justify-between px-2 py-1 hover:bg-white/5"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onToggle?.()
        }}
      >
        <span className="text-[11px] font-medium text-purple-300">
          {expanded ? '▼' : '▶'} {label}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCopy?.()
          }}
          className="px-1.5 py-0.5 text-[10px] text-purple-400/60 hover:text-purple-300"
        >
          copy
        </button>
      </div>
      {expanded && content ? (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border-t border-purple-500/20 p-2 font-mono text-[10px] text-purple-200">
          {content}
        </pre>
      ) : null}
    </div>
  )
}
