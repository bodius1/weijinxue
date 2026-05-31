import { useState } from 'react'
import { useAuth } from '../context/useAuth.js'
import { StoryStateProvider, useStoryState } from './StoryStateContext.jsx'
import YubanOnboarding from './onboarding/YubanOnboarding.jsx'
import StoryContextPanel from './panels/StoryContextPanel.jsx'
import { MasteryDashboard } from './components/MasteryDashboard.jsx'
import YubanChatTab from '../tabs/YubanTab.jsx'

/** @param {{ onOpenAuth?: () => void }} props */
function YubanTabInner({ onOpenAuth }) {
  const { user, loading: authLoading } = useAuth()
  const { state, loading: storyLoading, isOnboarded } = useStoryState()
  const [storyPanelOpen, setStoryPanelOpen] = useState(false)
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [turnEvalHistory, setTurnEvalHistory] = useState(/** @type {Array<{ evaluation?: string }>} */ ([]))

  if (authLoading || (user && storyLoading)) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-[#8C7A52]">
        Loading your story…
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-12 text-center">
        <h2 className="text-lg font-semibold text-[#D4A843]">Yǔbàn AI</h2>
        <p className="text-sm leading-relaxed text-[#E8D5A3]">
          Sign in to save your Chinese story, characters you meet, and vocabulary across sessions.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="rounded-xl bg-[#D4A843] px-5 py-2.5 text-sm font-semibold text-[#0F0E0C] transition hover:bg-[#b8872a]"
        >
          Sign In
        </button>
      </div>
    )
  }

  if (!isOnboarded) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <YubanOnboarding />
      </div>
    )
  }

  if (dashboardOpen) {
    return (
      <div className="flex flex-1 flex-col py-4">
        <MasteryDashboard onBack={() => setDashboardOpen(false)} turnHistory={turnEvalHistory} />
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-1 flex-col gap-2">
      <div className="flex items-center justify-end lg:hidden">
        <button
          type="button"
          onClick={() => setStoryPanelOpen(true)}
          className="rounded-lg border border-[rgba(212,168,67,0.3)] px-3 py-1.5 text-sm text-[#E8D5A3] hover:border-[#D4A843]/50"
          aria-label="Open your story panel"
        >
          📖 Your Story
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="min-w-0 flex-[7] lg:flex-[7]">
          <YubanChatTab onTurnHistoryChange={setTurnEvalHistory} />
        </div>
        <StoryContextPanel
          state={state}
          className="hidden lg:block"
          onOpenDashboard={() => setDashboardOpen(true)}
        />
      </div>

      {storyPanelOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal
          aria-label="Your story"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close story panel"
            onClick={() => setStoryPanelOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col p-3">
            <StoryContextPanel
              state={state}
              className="h-full overflow-y-auto shadow-xl"
              onOpenDashboard={() => {
                setStoryPanelOpen(false)
                setDashboardOpen(true)
              }}
            />
            <button
              type="button"
              onClick={() => setStoryPanelOpen(false)}
              className="mt-2 w-full rounded-lg border border-[rgba(212,168,67,0.3)] py-2 text-sm text-[#E8D5A3]"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** @param {{ onOpenAuth?: () => void }} props */
export default function YubanTabShell({ onOpenAuth }) {
  return (
    <StoryStateProvider>
      <YubanTabInner onOpenAuth={onOpenAuth} />
    </StoryStateProvider>
  )
}
