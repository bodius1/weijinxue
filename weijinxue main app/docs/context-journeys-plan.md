# Journeys — Context-Specific Learning Paths

**Status:** Design (Phase 1) — no implementation yet  
**Internal name:** Context Journeys / Scenario Paths  
**UI name:** **Journeys** (subtitle: *Practice Chinese by situation, not just by HSK level.*)  
**MVP context:** Time & Dates (`time-date`)

---

## 1. Product goal

### Problem

Yǔbàn AI today feels like: *“Talk to an AI and hope it adapts.”* That is powerful for advanced users but intimidating for beginners. The curriculum is implicit (story scenarios, HSK level, pattern mastery) rather than explicit and navigable.

### Solution

Add **Journeys**: structured, context-bound learning paths where:

- The learner picks a **real-life scenario** (e.g. Time & Dates, Hotel Lobby).
- They advance through a **small roadmap** of stages with clear unlock rules.
- **Deterministic drills** work without any API key.
- **Guided Yǔbàn AI** is one practice mode *inside* a stage—not the default open-ended chat.
- Complexity increases only when **progress is logged**, not when the model guesses level.

### Position in the app

Weijinxue is a single-page educational SPA with a **shared linguistic core** (pinyin IME, `pinyinIme.js`, `sentenceIme.js`, CEDict-backed lookup, HSK data). Tabs should extend that core, not become isolated mini-apps.

| Tab | Role |
|-----|------|
| Learn | Vocabulary discovery |
| Type | Input speed + sentences |
| Flashcards / Quiz | Memory + recall |
| Exam | Formal HSK-style assessment |
| **Journeys** | **Survival Mandarin by real-world context** |
| Yǔbàn AI | Conversation engine (guided inside Journeys; classic mode optional) |

### Non-goals for MVP

- Multiple fully built contexts (only **Time & Dates** deep).
- Replacing Yǔbàn story mode or removing Classic/Free Chat.
- New runtime dependencies.
- Client-side site-wide aggregates in Firestore (follow `studyStatsFirestore.js` TODO pattern).

---

## 2. UX flow

### 2.1 Tab entry — `JourneysTab`

**Continue Learning** (top card, if active progress exists):

```text
Continue Learning
Time & Dates — Stage 3: Calendar Dates
[Continue]
```

**Situational Journeys** (grid/list of scenario cards):

```text
[Time & Dates]       62%   ← MVP, unlocked
[Hotel Lobby]        25%   ← placeholder / coming soon
[Ordering Food]      locked
[Directions]         locked
…
```

Visual language: dark parchment / gold (`#0F0E0C`, `#D4A843`, `#E8D5A3`) consistent with Yǔbàn and Type sentences mode—not Duolingo-bright, but roadmap-clear.

### 2.2 Journey roadmap — e.g. Time & Dates

```text
Time & Dates 时间和日期

● Today / Tomorrow / Yesterday     Complete
● Weekdays                         Complete
● Calendar Dates                   Current
○ Clock Time                       Locked
○ Appointments                     Locked
○ Mixed Practice                   Locked
```

Tap **current** stage → lesson screen.

### 2.3 Lesson node screen

```text
Calendar Dates
Learn to say dates like 五月二十三号.

New words: 月, 号, 生日, …

Pattern:
今天是 + month + date
今天是五月二十三号。

[Mini Drill]          ← deterministic, no AI
[Type Practice]       ← reuse stream pinyin / short phrases where fit
[Practice with Yǔbàn AI]  ← guided mode, stage-scoped
```

Each stage ends with **mastery requirements** (drills + optional AI turns). Completing unlocks the next node.

### 2.4 Yǔbàn modes (after MVP integration)

| Mode | Default for | Behavior |
|------|-------------|----------|
| **Guided Journey** | Beginners, Journeys entry | One question at a time; vocabulary/patterns from active `ContextPack` stage; short Chinese; structured JSON reply + deterministic fallback |
| **Classic / Free Chat** | Power users | Current open-ended Yǔbàn (story + BYOK); secondary entry, settings for provider/keys |

Yǔbàn landing should show **Continue Journey** when applicable, then Guided options, then Free Chat—not API keys first.

---

## 3. Proposed file structure

```text
src/
  tabs/
    JourneysTab.jsx                 # lazy tab (add to App.jsx TABS)

  journeys/
    data/
      contextPacks/
        timeDate.js                 # MVP pack (full 6 stages)
        index.js                    # registry: getContextPack(id)

    components/
      JourneyMap.jsx                # list of scenario cards + continue card
      JourneyCard.jsx
      LessonNode.jsx                # stage lesson shell
      ScenarioPracticePanel.jsx     # guided AI launch + in-stage chat chrome
      ContextProgressRing.jsx
      MiniDrillCard.jsx

    engine/
      contextPackSchema.js          # JSDoc types + validators (plain JS)
      contextEngine.js              # resolve stage, allowed vocab, complexity caps
      contextProgressStore.js       # single write path: local + optional Firestore
      contextUnlocks.js             # mastery → unlock next stage
      contextDrillGenerator.js      # optional helpers from pack drills

    hooks/
      useContextProgress.js
      useActiveJourney.js

  yuban/
    guided/
      buildGuidedContextPrompt.js
      guidedSessionReducer.js
      guidedResponseParser.js
      guidedGrading.js              # thin wrapper or reuse gradeYubanTurn patterns

docs/
  context-journeys-plan.md          # this document
```

**Reuse (do not fork):**

| Need | Existing module |
|------|-----------------|
| Pinyin normalize / IME | `src/utils/pinyinIme.js` |
| Stream typing drills | `src/type/components/PinyinStreamInput.jsx`, `src/type/utils/pinyinSyllables.js` |
| Multiple choice | `src/components/MultipleChoiceQuiz.jsx` |
| Grading / three voices patterns | `src/yuban/conversation/buildGradingPrompt.js`, `gradeYubanTurn.js` |
| Auth | `src/context/AuthProvider.jsx`, `useAuth.js` |
| Firestore client | `src/firebase.js`, patterns in `studyStatsFirestore.js` |
| Lazy tabs | `src/App.jsx` `TABS` + `lazy()` |

**Do not modify** `pinyinIme.js` / `sentenceIme.js` unless a Journey-specific gap is proven.

---

## 4. ContextPack schema

Data-first: each scenario is a plain JS module, not hardcoded UI.

### 4.1 Top-level `ContextPack`

```js
/**
 * @typedef {Object} ContextPack
 * @property {string} id                    // e.g. "time-date"
 * @property {string} title                 // "Time & Dates"
 * @property {string} [chineseTitle]       // "时间和日期"
 * @property {string} description
 * @property {[number, number]} hskRange    // [1, 2]
 * @property {string} [icon]               // lucide name or internal icon key
 * @property {ContextStage[]} stages
 */
```

### 4.2 `ContextStage`

```js
/**
 * @typedef {Object} ContextStage
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {string | null} unlocksAfter   // previous stage id, or null for first
 * @property {TargetWord[]} targetWords
 * @property {PatternBlock[]} patterns
 * @property {ContextDrill[]} drills
 * @property {AiScenario} aiScenario
 * @property {StageMastery} mastery
 * @property {StageComplexity} [complexity] // optional override; else engine defaults by index
 */
```

### 4.3 Supporting types

```js
/** @typedef {{ hanzi: string, pinyin: string, english: string }} TargetWord */

/**
 * @typedef {Object} PatternBlock
 * @property {string} id
 * @property {string} chinese              // template label, e.g. "我 + time + action"
 * @property {string[]} examples
 */

/**
 * @typedef {Object} ContextDrill
 * @property {'multiple-choice'|'translate-to-chinese'|'pinyin-input'|'reply-short'} type
 * @property {string} prompt
 * @property {string} [promptChinese]
 * @property {string} [answer]
 * @property {string[]} [acceptedPinyin]   // toneless, normalized via pinyinIme
 * @property {string[]} [choices]
 * @property {string} [expectedIdea]
 * @property {string[]} [sampleAnswers]
 */

/**
 * @typedef {Object} AiScenario
 * @property {string} setting
 * @property {string[]} allowedTopics
 * @property {string[]} [bannedTopics]
 * @property {number} maxNewWords
 * @property {number} maxSentenceLengthChineseChars
 */

/**
 * @typedef {Object} StageMastery
 * @property {number} requiredCorrectDrills
 * @property {number} [requiredAiTurns]
 * @property {number} [minAccuracy]          // 0–1, default 0.8
 */

/**
 * @typedef {Object} StageComplexity
 * @property {number} maxSentenceLength
 * @property {number} maxNewWords
 * @property {boolean} pinyinAlwaysVisible
 * @property {boolean} englishGlossVisible
 */
```

### 4.4 Example excerpt — `timeDate.js` stage 1

See user spec; implement all six stages in Phase 2:

1. `today-tomorrow-yesterday`
2. `weekdays`
3. `calendar-dates`
4. `clock-time`
5. `appointments`
6. `mixed-scenario` (hotel checkout / breakfast / taxi pickup dialogue)

Vocabulary must stay **HSK 1–2** friendly; patterns must be reusable in drills and AI allow-lists.

---

## 5. Progress model (local + Firestore)

### 5.1 Design principles

- **Local-first:** anonymous users fully functional via `localStorage`.
- **Single write path:** all mutations through `contextProgressStore.js` (never from UI components directly).
- **Safe merge:** never overwrite richer local progress with empty or stale cloud state (same risk class as `studyStatsFirestore.js` / profile stats).
- **No secrets in Firestore:** BYOK API keys remain in `localStorage` only (`YubanTab.jsx` pattern).

### 5.2 Local storage

**Key:** `weijinxue-context-progress-v1`

**Shape (entire app):**

```js
{
  version: 1,
  contexts: {
    "time-date": { /* ContextProgressDoc */ }
  },
  updatedAt: 1710000000000
}
```

### 5.3 Per-context document

```js
/**
 * @typedef {Object} ContextProgressDoc
 * @property {string} contextId
 * @property {string} activeStageId
 * @property {string[]} unlockedStageIds
 * @property {string[]} completedStageIds
 * @property {Record<string, StageStats>} stageStats
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} StageStats
 * @property {number} correctDrills
 * @property {number} incorrectDrills
 * @property {number} aiTurnsCompleted
 * @property {number} lastPracticedAt
 * @property {number} [masteryScore]       // 0–1 rolling
 */
```

### 5.4 Firestore (Phase 3b — after local store)

**Path:** `users/{uid}/contextProgress/{contextId}`

Same fields as local doc + `updatedAt` (server or client ms). On sign-in:

1. Load local snapshot.
2. Fetch cloud doc(s) for active contexts (or all touched).
3. Merge per `contextId`: keep document with **more completed stages** or **newer `updatedAt`** if tie-break needed; never drop `completedStageIds` from the richer side.
4. Write merged result back to local; debounced cloud upload on change.

### 5.5 Store API (Phase 3)

```js
getContextProgress(contextId)
updateStageProgress(contextId, stageId, patch)
markStageComplete(contextId, stageId)
unlockNextStage(contextId, stageId)
getActiveStage(contextId)
getJourneySummary()              // for Continue card + % on JourneyCard
```

`contextUnlocks.js` evaluates `StageMastery` against `stageStats` and calls store when thresholds met.

---

## 6. Guided Yǔbàn AI design

### 6.1 Launch contract

Yǔbàn (or `ScenarioPracticePanel`) receives:

```js
{
  mode: 'guided-context',
  contextId: 'time-date',
  stageId: 'clock-time',
}
```

Classic mode unchanged: `mode: 'classic'` or existing story flow.

### 6.2 Prompt builder — `buildGuidedContextPrompt.js`

**Inputs:**

```js
buildGuidedContextPrompt({
  contextPack,
  stage,
  userProgress,
  recentMistakes,
  userLevel,           // HSK from profile or default 1
  conversationHistory,
})
```

**Rules encoded in prompt:**

- Teach **only** active context + stage title.
- Inject `targetWords`, `patterns.examples`, `aiScenario.allowedTopics`.
- Respect `maxNewWords`, `maxSentenceLengthChineseChars`, `bannedTopics`.
- One short question at a time; mostly HSK 1 Chinese for early stages.
- Brief correction after user message; no long prose unless asked.
- If user writes English, gently steer to target Chinese.

**Output contract (JSON preferred):**

```json
{
  "chineseReply": "",
  "pinyin": "",
  "english": "",
  "correction": null,
  "nextPrompt": "",
  "masterySignal": "none|progress|stage_ready"
}
```

### 6.3 Parsing and fallback

- `guidedResponseParser.js` — validate JSON; strip markdown fences.
- On parse failure: deterministic line from `stage.patterns[0].examples` or canned NPC line from `aiScenario.setting`.
- `guidedSessionReducer.js` — turn state, history cap, mistake buffer for prompt.

### 6.4 Grading

Prefer **lightweight** stage-scoped checks for guided turns (expected patterns / sample answers) before full three-voices grader. Reuse `buildThreeVoicesGradingPrompt` only where parity with story mode is needed; avoid doubling token cost per turn in MVP.

### 6.5 Complexity ramp (stage-controlled, not model-guessed)

Default engine map by stage index (overridable per stage):

| Stage index | maxSentenceLength | maxNewWords | pinyin visible | english gloss |
|-------------|-------------------|-------------|----------------|---------------|
| 1 | 8 | 1 | yes | yes |
| 2 | 12 | 2 | yes | yes |
| 3 | 16 | 2 | no | yes |
| 4+ | 20 | 3 | no | no |

---

## 7. Deterministic drills (Phase 5)

Drills must work **without** Anthropic/Groq keys.

### Supported types (MVP)

| Type | Validation |
|------|------------|
| `multiple-choice` | Exact choice hanzi |
| `translate-to-chinese` | Hanzi match or normalized pinyin in `acceptedPinyin` |
| `pinyin-input` | `pinyinIme` normalization vs `answer` |
| `reply-short` | Hanzi overlap / sampleAnswers / optional local fuzzy |

### `MiniDrillCard` behavior

- One drill at a time from stage queue.
- Show feedback on submit.
- Increment `stageStats.correctDrills` / `incorrectDrills`.
- When `mastery` satisfied → `markStageComplete` + `unlockNextStage`.
- Optional: shallow integration with Type tab phrase (same row shape as `sentences_hsk1.json` with empty `py` is OK—runtime pinyin lookup).

---

## 8. App integration points

### 8.1 `App.jsx`

Add to `TABS` (order suggestion: after Type, before Yǔbàn):

```js
{ id: 'journeys', label: 'Journeys', Component: JourneysTab }
```

Lazy import mirroring existing tabs. Extend `TAB_ALIASES` in `studyStatsFirestore.js` if journey activity should count toward study days (`journeysDrills` / `journeyAiTurns`).

### 8.2 Analytics

Use `trackTabView` / `trackEvent` (`src/utils/analytics.js`) for:

- `journey_open`, `stage_start`, `stage_complete`, `drill_correct`, `guided_turn`

### 8.3 Yǔbàn shell

`YubanTabShell.jsx` currently gates on story onboarding. Guided Journey can:

- Launch as embedded panel inside `JourneysTab` (preferred for MVP), **or**
- Deep-link into Yǔbàn with query/state `{ guidedContext, stageId }` without requiring full story state.

Recommendation: **embed** guided chat in `ScenarioPracticePanel` inside Journeys to avoid forcing story onboarding for drill-only users.

---

## 9. MVP scope — Time & Dates only

### In scope

- [ ] `Journeys` tab + roadmap UI
- [ ] One `ContextPack`: `time-date` (6 stages, full data)
- [ ] Local progress store + unlock logic
- [ ] `MiniDrillCard` for all drill types used in pack
- [ ] Guided AI for stage practice (with fallback)
- [ ] Classic Yǔbàn still reachable; not default for new users
- [ ] Continue Learning card

### Out of scope (post-MVP)

- Hotel, Food, Directions, Shopping packs (data-only once engine exists)
- Firestore sync (designed in Phase 3b, implement after local stable)
- Cross-journey recommendations
- Audio / TTS per word
- Leaderboards for Journeys

### Placeholder cards

Non-MVP journeys may appear as **locked** or **Coming soon** with 0% progress to communicate roadmap without implementing content.

---

## 10. Implementation phases (for Cursor)

| Phase | Deliverable |
|-------|-------------|
| **1** | This document ✓ |
| **2** | `contextPackSchema.js`, `timeDate.js`, `index.js` |
| **3** | `contextProgressStore.js`, `useContextProgress.js`, `contextUnlocks.js` |
| **3b** | Firestore sync (merge-safe) |
| **4** | `JourneysTab` + roadmap/lesson components |
| **5** | `MiniDrillCard` + drill validation |
| **6** | `yuban/guided/*` + launch from stage |
| **7** | Yǔbàn entry simplification (Continue Journey, Free Chat secondary) |

Do **not** implement all phases in one prompt.

---

## 11. Acceptance criteria (MVP)

1. **Journeys** tab visible and lazy-loaded.
2. User can open **Time & Dates** and see six stages with locked / current / complete.
3. User can complete **deterministic drills** with no API key.
4. Progress survives refresh (`weijinxue-context-progress-v1`).
5. **Practice with Yǔbàn AI** opens guided mode scoped to stage; replies stay on-topic.
6. Malformed model output does not break UI (fallback lines).
7. **Classic / Free Chat** Yǔbàn still works for signed-in story users.
8. No regression to Type/Learn/Quiz/Exam tabs.

---

## 12. Testing plan

### Unit

- `contextUnlocks.js` — mastery thresholds, first stage unlocked, linear unlock chain.
- `contextProgressStore.js` — read/write/merge local snapshots (mock `localStorage`).
- Drill validators — pinyin normalize via shared util; reply-short sample matching.
- `guidedResponseParser.js` — valid JSON, invalid JSON → fallback flag.

### Integration (manual)

- Anonymous user: complete stage 1 drills → refresh → still complete.
- Sign in (when Firestore phase exists): complete on device A, merge on device B without losing `completedStageIds`.
- Launch guided AI on stage 4 with only clock vocabulary in prompt (spot-check logs in dev).
- Mobile: roadmap scroll, lesson stack, drill input keyboard.

### Regression

- `npm run build` passes.
- Existing `npm run test:yuban` (if touched) still passes.
- Type sentences mode + Yǔbàn classic unchanged when Journeys not used.

---

## 13. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Local/cloud progress diverge | Single store module; merge by richness + `updatedAt`; never write empty cloud over local |
| Yǔbàn onboarding blocks Journey AI | Embed guided panel in JourneysTab for MVP |
| Scope creep (many contexts) | Ship one pack; second pack is copy-paste data |
| AI off-topic | Hard allow-list in prompt + short max length + deterministic fallback |
| Duplicating pinyin logic | Mandate `pinyinIme.js` import in drill validator |
| Tab bar clutter | One tab “Journeys”; scenarios inside |

---

## 14. Reference — current architecture snapshot

- **Stack:** React 19 + Vite, Firebase Auth/Firestore, lazy tabs in `App.jsx`.
- **Tabs today:** Learn, Flashcards, Quiz, Type, Yǔbàn AI, Exam (+ Profile via auth bar).
- **Yǔbàn:** `YubanTabShell` → story onboarding → `YubanTab` chat; grading via `buildGradingPrompt.js` / `gradeYubanTurn.js`; BYOK in localStorage.
- **Type sentences:** `PinyinStreamInput` + `extractSyllables` / `getPinyin` from dictionary; sentence rows may have empty `parts`/`py` with runtime lookup.
- **Progress elsewhere:** `learnedCharacters.js`, `studyStatsFirestore.js`, `hskProgressCloud.js`, quiz SR in localStorage.

Journeys should feel like the missing layer: **structured context** on top of this stack, with Yǔbàn as the conversation engine—not the curriculum author.

---

## 15. Naming reference

| Layer | Name |
|-------|------|
| Tab | Journeys |
| User-facing unit | Scenario (e.g. Time & Dates) |
| Internal/data | Context Pack (`contextId`) |
| Step on roadmap | Stage |
| Chinese concept (optional marketing) | 场景 (chǎngjǐng) |

---

*Document version: 1.0 — Phase 1 design only.*
