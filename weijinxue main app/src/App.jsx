import { useEffect, useRef, useState } from 'react'
import { AuthProvider } from './context/AuthProvider.jsx'
import { useAuth } from './context/useAuth.js'
import AuthModal from './components/AuthModal.jsx'
import LanternBackground from './components/LanternBackground.jsx'
import LearnTab from './tabs/LearnTab.jsx'
import FlashcardsTab from './tabs/FlashcardsTab.jsx'
import QuizTab from './tabs/QuizTab.jsx'
import TypeTab from './tabs/TypeTab.jsx'
import YubanTab from './tabs/YubanTab.jsx'
import { preloadFormatEnglishMeaningData } from './utils/formatEnglishMeaning.js'
import { preloadPinyinImeData } from './utils/pinyinIme.js'
import { preloadSentenceData } from './utils/sentenceData.js'

const TABS = [
  { id: 'learn', label: 'Learn', Component: LearnTab },
  { id: 'flashcards', label: 'Flashcards', Component: FlashcardsTab },
  { id: 'quiz', label: 'Quiz', Component: QuizTab },
  { id: 'type', label: 'Type', Component: TypeTab },
  { id: 'yuban', label: 'Yǔbàn AI', Component: YubanTab },
]

/** @param {import('firebase/auth').User} user */
function welcomeFirstName(user) {
  const name = user.displayName?.trim()
  if (name) {
    const first = name.split(/\s+/)[0]
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
  }
  const email = user.email?.trim()
  const local = email?.split('@')[0] ?? ''
  if (!local) return 'there'
  const clean = local.replace(/[._]+/g, ' ').trim()
  const word = clean.split(/\s+/)[0] || local
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

/** Standalone profile glyph (no ring) — same geometry as before, sized for visibility without a circular frame. */
function IconUserMenu() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      <path d="M4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function UserAuthBar({ onOpenAuth }) {
  const { user, loading, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  useEffect(() => {
    if (!user) queueMicrotask(() => setMenuOpen(false))
  }, [user])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(/** @type {Node} */ (e.target))) {
        setMenuOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  if (loading) return null

  if (user) {
    return (
      <div className="relative flex shrink-0 items-center" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex shrink-0 items-center justify-center rounded-md py-3 px-2 text-[#D4A843] transition hover:bg-elevated/90 hover:text-[#e4bc5c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843]/80"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Account menu"
        >
          <IconUserMenu />
        </button>

        {menuOpen ? (
          <div
            className="absolute right-0 top-full z-50 mt-1.5 min-w-[10.5rem] rounded-xl border border-taupe bg-parchment py-1 shadow-lg shadow-ink/20 ring-1 ring-[#D4A843]/15"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center px-3 py-2.5 text-left text-sm text-ink hover:bg-elevated"
              onClick={() => {
                setMenuOpen(false)
                void signOut()
              }}
            >
              <span className="mr-2.5 text-base opacity-90" aria-hidden>
                🚪
              </span>
              Sign Out
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpenAuth}
      className="shrink-0 rounded-t-lg bg-[#D4A843] px-4 py-3 text-xs font-semibold text-ink shadow-sm transition hover:bg-[#c49a3d] sm:px-5 sm:text-sm"
    >
      Sign In
    </button>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
  const [activeId, setActiveId] = useState('learn')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [toast, setToast] = useState(/** @type {null | { id: number; text: string }} */ (null))
  const active = TABS.find((t) => t.id === activeId) ?? TABS[0]
  const ActivePanel = active.Component

  const authTransition = useRef({ ready: false, hadUser: false })

  useEffect(() => {
    if (user) queueMicrotask(() => setAuthModalOpen(false))
  }, [user])

  useEffect(() => {
    if (loading) return
    const hasUser = Boolean(user)
    if (!authTransition.current.ready) {
      authTransition.current = { ready: true, hadUser: hasUser }
      return
    }
    const { hadUser } = authTransition.current
    if (!hadUser && hasUser && user) {
      queueMicrotask(() =>
        setToast({ id: Date.now(), text: `Welcome back, ${welcomeFirstName(user)}! 👋` }),
      )
    } else if (hadUser && !hasUser) {
      queueMicrotask(() => setToast({ id: Date.now(), text: 'Signed out successfully' }))
    }
    authTransition.current.hadUser = hasUser
  }, [user, loading])

  return (
    <div className="relative isolate min-h-screen bg-paper text-ink">
      <LanternBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-taupe bg-parchment">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pb-0 pt-4">
            <nav
              className="flex min-w-0 flex-1 items-stretch gap-0"
              aria-label="Main"
              role="tablist"
            >
              {TABS.map((tab) => {
                const isActive = tab.id === activeId
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    type="button"
                    onClick={() => setActiveId(tab.id)}
                    className={[
                      'relative min-w-0 flex-1 rounded-t-lg px-2 py-3 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
                      isActive
                        ? 'bg-paper text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-clay'
                        : 'text-espresso hover:bg-elevated/90 hover:text-ink',
                    ].join(' ')}
                    aria-selected={isActive}
                    role="tab"
                  >
                    {tab.label}
                  </button>
                )
              })}
            </nav>
            <div className="flex shrink-0 items-center self-stretch">
              <UserAuthBar onOpenAuth={() => setAuthModalOpen(true)} />
            </div>
          </div>
        </header>

        <main
          className="mx-auto flex w-full max-w-3xl flex-1 flex-col bg-transparent px-4 py-8"
          role="tabpanel"
          aria-labelledby={`tab-${activeId}`}
        >
          {activeId === 'quiz' ? (
            <QuizTab onGoToLearn={() => setActiveId('learn')} />
          ) : activeId === 'type' ? (
            <TypeTab />
          ) : (
            <ActivePanel />
          )}
        </main>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed left-1/2 top-[4.25rem] z-[200] flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 justify-center sm:top-[4.5rem]">
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className="huaxue-toast-pop pointer-events-auto rounded-xl border border-[#D4A843]/55 bg-parchment/95 px-5 py-3 text-center text-sm font-medium text-ink shadow-xl shadow-ink/25 ring-1 ring-[#D4A843]/20 backdrop-blur-sm"
            onAnimationEnd={() => {
              const ended = toast.id
              setToast((t) => (t && t.id === ended ? null : t))
            }}
          >
            {toast.text}
          </div>
        </div>
      ) : null}

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  )
}

export default function App() {
  const [imeReady, setImeReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    Promise.all([preloadPinyinImeData(), preloadFormatEnglishMeaningData(), preloadSentenceData()])
      .then(() => {
        if (!cancelled) setImeReady(true)
      })
      .catch((err) => {
        console.error('Failed to load dictionary data', err)
        if (!cancelled) setImeReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!imeReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment text-espresso">
        <p className="text-sm">Loading dictionary…</p>
      </div>
    )
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
