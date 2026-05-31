import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AuthProvider } from './context/AuthProvider.jsx'
import { useAuth } from './context/useAuth.js'
import AuthModal from './components/AuthModal.jsx'
import LanternBackground from './components/LanternBackground.jsx'
import { preloadFormatEnglishMeaningData } from './utils/formatEnglishMeaning.js'
import { preloadSentenceData } from './utils/sentenceData.js'
import AboutModal from './components/chrome/AboutModal.jsx'
import AppFooter from './components/chrome/AppFooter.jsx'
import ContactModal from './components/chrome/ContactModal.jsx'
import PrivacyModal from './components/chrome/PrivacyModal.jsx'
import { APP_VERSION_LABEL } from './config/appMeta.js'
import { trackEvent, trackTabView } from './utils/analytics.js'
import { seedLeaderboard } from './utils/seedLeaderboard.js'

const LearnTab = lazy(() => import('./tabs/LearnTab.jsx'))
const FlashcardsTab = lazy(() => import('./tabs/FlashcardsTab.jsx'))
const QuizTab = lazy(() => import('./tabs/QuizTab.jsx'))
const TypeTab = lazy(() => import('./tabs/TypeTab.jsx'))
const YubanTab = lazy(() => import('./yuban/YubanTabShell.jsx'))
const ExamTab = lazy(() => import('./tabs/ExamTab.jsx'))
const JourneysTab = lazy(() => import('./tabs/JourneysTab.jsx'))
const ProfileTab = lazy(() => import('./tabs/ProfileTab.jsx'))

const TABS = [
  { id: 'learn', label: 'Learn', Component: LearnTab },
  { id: 'flashcards', label: 'Flashcards', Component: FlashcardsTab },
  { id: 'quiz', label: 'Quiz', Component: QuizTab },
  { id: 'type', label: 'Type', Component: TypeTab },
  { id: 'journeys', label: 'Journeys', Component: JourneysTab },
  { id: 'yuban', label: 'Yǔbàn AI', Component: YubanTab },
  { id: 'exam', label: 'Exam', Component: ExamTab },
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

function UserAuthBar({ onOpenAuth, onOpenProfile }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (user) {
    return (
      <button
        type="button"
        onClick={onOpenProfile}
        className="flex shrink-0 items-center justify-center rounded-md py-2 px-2 text-[#D4A843] transition hover:bg-elevated/90 hover:text-[#e4bc5c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843]/80"
        aria-label="Profile and stats"
      >
        <IconUserMenu />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpenAuth}
      className="shrink-0 rounded-md border border-taupe bg-elevated/50 px-3 py-2 text-[11px] font-medium text-espresso transition hover:border-[#D4A843]/50 hover:text-[#D4A843] sm:px-4 sm:text-xs"
    >
      Sign In
    </button>
  )
}

function TabLoader() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      gap: '1rem',
    }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#D4A843',
            animation: 'tab-pulse 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
            opacity: 0,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes tab-pulse {
          0%, 100% { opacity: 0.15; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
  const [activeId, setActiveId] = useState('learn')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [chromeModal, setChromeModal] = useState(/** @type {null | 'contact' | 'about' | 'privacy'} */ (null))
  const [toast, setToast] = useState(/** @type {null | { id: number; text: string }} */ (null))
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

  useEffect(() => {
    trackEvent('app_open', { app_version: APP_VERSION_LABEL })
  }, [])

  useEffect(() => {
    const label =
      activeId === 'profile' ? 'Profile' : TABS.find((t) => t.id === activeId)?.label ?? activeId
    trackTabView(label)
  }, [activeId])

  const learningTab = TABS.find((t) => t.id === activeId) ?? TABS[0]
  const LearningPanel = learningTab.Component

  return (
    <div className="relative isolate min-h-screen bg-paper text-ink">
      <LanternBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-taupe/80 bg-[#1c1a16]">
          <div className="mx-auto max-w-3xl px-3 pb-0 pt-2 sm:px-4 sm:pt-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveId('learn')}
                className="min-w-0 shrink-0 text-left transition hover:brightness-125"
                aria-label="Weijinxue — go to Learn"
              >
                <span className="inline-block rounded border border-[#D4A843] px-1.5 py-px text-[11px] font-semibold uppercase tracking-widest text-[#D4A843] sm:px-2 sm:py-0.5 sm:text-xs">
                  WEIJINXUE
                </span>
              </button>
              <div className="flex shrink-0 items-center">
                <UserAuthBar
                  onOpenAuth={() => setAuthModalOpen(true)}
                  onOpenProfile={() => setActiveId('profile')}
                />
              </div>
            </div>
            <nav
              className="mt-1.5 flex min-w-0 items-stretch gap-0 border-t border-taupe/50 pt-1 sm:mt-2 sm:pt-1.5"
              aria-label="Main"
              role="tablist"
            >
              {TABS.map((tab) => {
                const isActive = tab.id === activeId && activeId !== 'profile'
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    type="button"
                    onClick={() => setActiveId(tab.id)}
                    className={[
                      'relative min-w-0 flex-1 rounded-t-md px-2 py-2 text-sm font-medium transition-colors sm:px-2.5 sm:py-2.5 sm:text-base',
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
          </div>
        </header>

        <main
          className={[
            'mx-auto flex min-h-0 w-full flex-1 flex-col bg-transparent px-4 text-ink',
            activeId === 'yuban' ? 'max-w-6xl' : activeId === 'journeys' ? 'max-w-4xl' : 'max-w-3xl',
            activeId === 'quiz' || activeId === 'type' || activeId === 'yuban'
              ? 'py-4 pb-2 sm:py-5 sm:pb-3'
              : 'py-6 pb-8 sm:py-8',
          ].join(' ')}
          role="tabpanel"
          aria-labelledby={activeId === 'profile' ? 'profile-heading' : `tab-${activeId}`}
        >
          <Suspense fallback={<TabLoader />}>
            {activeId === 'profile' ? (
              <ProfileTab onOpenAuth={() => setAuthModalOpen(true)} />
            ) : activeId === 'quiz' ? (
              <QuizTab onGoToLearn={() => setActiveId('learn')} />
            ) : activeId === 'type' ? (
              <TypeTab />
            ) : activeId === 'yuban' ? (
              <YubanTab onOpenAuth={() => setAuthModalOpen(true)} />
            ) : (
              <LearningPanel />
            )}
          </Suspense>
        </main>

        <AppFooter
          onContact={() => setChromeModal('contact')}
          onAbout={() => setChromeModal('about')}
          onPrivacy={() => setChromeModal('privacy')}
        />
      </div>

      {toast ? (
        <div className="pointer-events-none fixed left-1/2 top-[4.75rem] z-[200] flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 justify-center sm:top-[5rem]">
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

      <ContactModal open={chromeModal === 'contact'} onClose={() => setChromeModal(null)} />
      <AboutModal open={chromeModal === 'about'} onClose={() => setChromeModal(null)} />
      <PrivacyModal open={chromeModal === 'privacy'} onClose={() => setChromeModal(null)} />
    </div>
  )
}

export default function App() {
  useEffect(() => {
    const splash = document.getElementById('splash')
    if (!splash) return
    splash.classList.add('out')
    const t = setTimeout(() => {
      splash.remove()
      document.getElementById('splash-style')?.remove()
    }, 700)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    Promise.all([preloadFormatEnglishMeaningData(), preloadSentenceData()]).catch((err) => {
      console.error('Failed to preload app data', err)
    })
  }, [])

  // TEMP: remove this useEffect after console shows 10 checkmarks + "Seed complete"
  useEffect(() => {
    seedLeaderboard().catch((err) => console.error('seedLeaderboard failed', err))
  }, [])

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
