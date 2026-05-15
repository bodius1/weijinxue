import { useEffect, useMemo, useRef, useState } from 'react'
import { audioMap as defaultAudioMap } from '../utils/ankiDeckData.js'
import { ankiAudioSrcCandidates, buildPlaybackPlan } from '../utils/ankiAudioPlayback.js'

/** Overlap between character clips after silence trim (seconds). */
const FALLBACK_OVERLAP_SECONDS = 0.04

const SILENCE_THRESHOLD = 0.01

/** @type {Map<string, AudioBuffer>} trimmed decoded clips (Web Audio fallback only) */
const decodedBufferByUrl = new Map()

/** Stop any in-flight Web Audio sources (new speaker click). */
const activeFallbackStops = []

function stopAllFallbackSources() {
  for (const fn of activeFallbackStops) {
    try {
      fn()
    } catch {
      /* */
    }
  }
  activeFallbackStops.length = 0
}

/** Lazy singleton; created only on first character-fallback play (user gesture). */
let sharedAudioContext = /** @type {AudioContext | null} */ (null)

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!sharedAudioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) throw new Error('Web Audio API not available')
    sharedAudioContext = new Ctx()
  }
  return sharedAudioContext
}

/**
 * @param {AudioContext} audioCtx
 * @param {AudioBuffer} buffer
 * @returns {AudioBuffer}
 */
function trimSilence(audioCtx, buffer) {
  const data = buffer.getChannelData(0)
  let start = 0
  let end = data.length - 1

  while (start < data.length && Math.abs(data[start]) < SILENCE_THRESHOLD) start++
  while (end > start && Math.abs(data[end]) < SILENCE_THRESHOLD) end--

  const samplesTrimmedStart = start
  const samplesTrimmedEnd = data.length - 1 - end

  if (end < start) {
    console.log('[Anki audio] trimSilence', {
      samplesTrimmedStart,
      samplesTrimmedEnd,
      originalFrames: data.length,
      trimmedFrames: 1,
      note: 'all-silence; using 1-frame placeholder',
    })
    return audioCtx.createBuffer(buffer.numberOfChannels, 1, buffer.sampleRate)
  }

  const frameCount = end - start + 1
  const trimmed = audioCtx.createBuffer(buffer.numberOfChannels, frameCount, buffer.sampleRate)

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const full = buffer.getChannelData(c)
    trimmed.copyToChannel(full.subarray(start, end + 1), c)
  }

  console.log('[Anki audio] trimSilence', {
    samplesTrimmedStart,
    samplesTrimmedEnd,
    originalFrames: data.length,
    trimmedFrames: frameCount,
  })

  return trimmed
}

/**
 * Exact phrase: HTML5 Audio only — streams from URL, no full-file decode, no buffer cache.
 * @param {string} mp3Filename
 * @param {import('react').MutableRefObject<HTMLAudioElement | null>} lastAudioRef
 */
async function playExactHtml5(mp3Filename, lastAudioRef) {
  const candidates = ankiAudioSrcCandidates(mp3Filename)
  let lastErr = /** @type {unknown} */ (null)
  for (const finalAudioPath of candidates) {
    const audio = new Audio()
    audio.preload = 'auto'
    try {
      audio.playsInline = true
    } catch {
      /* */
    }
    try {
      await new Promise((resolve, reject) => {
        const finish = () => {
          audio.removeEventListener('ended', finish)
          audio.removeEventListener('error', onErr)
          resolve()
        }
        const onErr = () => {
          audio.removeEventListener('ended', finish)
          audio.removeEventListener('error', onErr)
          reject(new Error('media error'))
        }
        audio.addEventListener('ended', finish, { once: true })
        audio.addEventListener('error', onErr, { once: true })
        lastAudioRef.current?.pause()
        audio.src = finalAudioPath
        lastAudioRef.current = audio
        void audio.play().catch(reject)
      })
      return
    } catch (err) {
      lastErr = err
      lastAudioRef.current?.pause()
      lastAudioRef.current = null
    }
  }
  throw lastErr ?? new Error('play failed')
}

/**
 * Fetch + decode one mp3 into an AudioBuffer; cache by canonical URL string.
 * Only called for character-fallback clips; only URLs for that term’s chars.
 * @param {string} mp3Filename
 * @param {AudioContext} ctx
 */
async function getOrDecodeBuffer(mp3Filename, ctx) {
  const candidates = ankiAudioSrcCandidates(mp3Filename)

  for (const url of candidates) {
    const hit = decodedBufferByUrl.get(url)
    if (hit) {
      console.log('[Anki audio] buffer', { url, loadSource: 'cache' })
      return hit
    }
  }

  for (const url of candidates) {
    const res = await fetch(url)
    if (!res.ok) continue
    const ab = await res.arrayBuffer()
    const decoded = await ctx.decodeAudioData(ab.slice(0))

    const ch0 = decoded.getChannelData(0)
    console.log('buffer duration:', decoded.duration)
    console.log('first 100 samples:', Array.from(ch0.slice(0, 100)))
    console.log('last 100 samples:', Array.from(ch0.slice(-100)))

    const trimmed = trimSilence(ctx, decoded)
    decodedBufferByUrl.set(url, trimmed)
    console.log('[Anki audio] buffer', { url, loadSource: 'network' })
    return trimmed
  }

  throw new Error(`no working URL for ${mp3Filename}`)
}

/**
 * Schedule buffers with overlap; resolve when the last buffer ends.
 * @param {AudioContext} ctx
 * @param {AudioBuffer[]} buffers
 */
function playBuffersWithOverlap(ctx, buffers) {
  if (buffers.length === 0) return Promise.resolve()

  const scheduleStart = ctx.currentTime + 0.02
  let t = scheduleStart
  const lastIndex = buffers.length - 1

  return new Promise((resolve, reject) => {
    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i]
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.connect(ctx.destination)
      const stop = () => {
        try {
          src.stop(0)
        } catch {
          /* */
        }
      }
      activeFallbackStops.push(stop)
      src.onended = () => {
        const ix = activeFallbackStops.indexOf(stop)
        if (ix >= 0) activeFallbackStops.splice(ix, 1)
        if (i === lastIndex) resolve()
      }
      try {
        src.start(t)
        t += buffer.duration - FALLBACK_OVERLAP_SECONDS
      } catch (e) {
        reject(e)
        return
      }
    }
  })
}

/**
 * Character fallback: fetch/decode only this term’s per-char mp3s; play via Web Audio.
 * @param {{ mp3: string; char?: string }[]} clips
 */
async function playFallbackWebAudio(clips) {
  const ctx = getAudioContext()
  if (!ctx) throw new Error('no AudioContext')

  await ctx.resume()

  const uniqueMp3s = [...new Set(clips.map((c) => c.mp3))]
  const buffers = await Promise.all(uniqueMp3s.map((mp3) => getOrDecodeBuffer(mp3, ctx)))

  const mp3ToBuffer = new Map(uniqueMp3s.map((mp3, i) => [mp3, buffers[i]]))
  const ordered = clips.map((c) => {
    const b = mp3ToBuffer.get(c.mp3)
    if (!b) throw new Error(`missing buffer for ${c.mp3}`)
    return b
  })

  await playBuffersWithOverlap(ctx, ordered)
}

/**
 * @param {{
 *   term: string
 *   audioFile?: string | null
 *   audioMap?: Record<string, string>
 * }} props
 */
export default function AudioButton({ term, audioFile, audioMap = defaultAudioMap }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playError, setPlayError] = useState(/** @type {string | null} */ (null))
  const warnedMissingRef = useRef(/** @type {Set<string>} */ (new Set()))
  const lastAudioRef = useRef(/** @type {HTMLAudioElement | null} */ (null))

  const playbackPlan = useMemo(() => buildPlaybackPlan(term, audioFile, audioMap), [term, audioFile, audioMap])
  const hasAudio = playbackPlan.clips.length > 0

  useEffect(() => {
    queueMicrotask(() => setPlayError(null))
  }, [term, playbackPlan])

  useEffect(() => {
    if (!term?.trim()) return
    if (hasAudio) return
    if (warnedMissingRef.current.has(term)) return
    warnedMissingRef.current.add(term)
    console.warn(`[Anki audio] No playable clips for term: ${term}`)
  }, [term, hasAudio])

  useEffect(
    () => () => {
      stopAllFallbackSources()
      lastAudioRef.current?.pause()
      lastAudioRef.current = null
    },
    [],
  )

  async function handlePlayAudio() {
    const plan = playbackPlan
    const audioMapValue = audioMap?.[term]

    if (plan.mode === 'none' || plan.clips.length === 0) {
      console.warn(`[Anki audio] No audio file resolved for term: ${term}`)
      return
    }

    stopAllFallbackSources()
    lastAudioRef.current?.pause()
    lastAudioRef.current = null
    setPlayError(null)
    setIsPlaying(true)

    console.log('[Anki audio] play start', {
      term,
      audioFile,
      audioMapValue,
      resolvedExactFile: plan.mode === 'exact' ? plan.clips[0]?.mp3 : null,
      playbackMode: plan.mode,
      filesInOrder: plan.clips.map((c) => c.mp3),
      missingChars: plan.missingChars,
      engine: plan.mode === 'exact' ? 'html5-audio' : 'web-audio-fallback',
    })

    const failAll = (detail) => {
      const msg =
        'Could not play audio. Copy the deck .mp3 files into mandarin-app/public/anki-audio/ using the exact filenames from audioMap (e.g. 學習_B_zh.mp3 for 学习).'
      setPlayError(msg)
      console.warn('[Anki audio]', detail)
      setIsPlaying(false)
    }

    try {
      if (plan.mode === 'exact') {
        const clip = plan.clips[0]
        const candidates = ankiAudioSrcCandidates(clip.mp3)
        const firstPath = candidates[0] || ''
        let pathnameOnly = firstPath
        try {
          pathnameOnly = new URL(firstPath).pathname
        } catch {
          /* */
        }

        await playExactHtml5(clip.mp3, lastAudioRef)

        console.log('[Anki audio] clip ok', {
          term,
          playbackMode: plan.mode,
          engine: 'html5-audio',
          mp3: clip.mp3,
          char: clip.char ?? null,
          pathnameOnly,
        })
      } else {
        await playFallbackWebAudio(plan.clips)

        console.log('[Anki audio] clip ok', {
          term,
          playbackMode: plan.mode,
          engine: 'web-audio-fallback',
          mp3s: plan.clips.map((c) => c.mp3),
          chars: plan.clips.map((c) => c.char ?? null),
        })
      }

      console.log('[Anki audio] play done', {
        term,
        playbackMode: plan.mode,
        filesPlayed: plan.clips.map((c) => c.mp3),
        missingChars: plan.missingChars,
        playResult: 'succeeded',
      })
    } catch (err) {
      console.log('[Anki audio] play done', {
        term,
        playbackMode: plan.mode,
        filesAttempted: plan.clips.map((c) => c.mp3),
        missingChars: plan.missingChars,
        playResult: 'failed',
        error: String(err),
      })
      failAll({ plan, err })
    } finally {
      setIsPlaying(false)
      lastAudioRef.current = null
    }
  }

  return (
    <div className="flex max-w-md flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => void handlePlayAudio()}
        disabled={!hasAudio}
        title={
          hasAudio
            ? `Play pronunciation for ${term}`
            : `No audio available for ${term}`
        }
        aria-label={hasAudio ? `Play audio for ${term}` : `No audio for ${term}`}
        className={[
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base leading-none transition',
          'border-taupe bg-elevated text-ink shadow-sm',
          'hover:border-clay hover:bg-parchment',
          'active:scale-95',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-taupe disabled:hover:bg-elevated',
        ].join(' ')}
      >
        <span aria-hidden>{isPlaying ? '🔊' : '🔈'}</span>
      </button>
      {playError ? (
        <p
          role="alert"
          className="text-center text-xs leading-snug text-accent-red text-pretty"
        >
          {playError}
        </p>
      ) : null}
    </div>
  )
}
