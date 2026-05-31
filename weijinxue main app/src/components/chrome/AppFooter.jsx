import { APP_VERSION_LABEL, GITHUB_URL, SUPPORT_URL } from '../../config/appMeta.js'
import { trackEvent, trackExternalClick } from '../../utils/analytics.js'

function IconContact({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  )
}

function IconHeart({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  )
}

function IconGitHub({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  )
}

function IconShield({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  )
}

function IconInfo({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  )
}

const itemCls =
  'inline-flex items-center gap-1 text-muted transition hover:text-[#D4A843] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A843]/60'

/** @param {{ onContact: () => void, onAbout: () => void, onPrivacy: () => void }} props */
export default function AppFooter({ onContact, onAbout, onPrivacy }) {
  return (
    <footer
      className="mt-auto border-t border-taupe/70 bg-[#0f0e0c]/90 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
      aria-label="Site"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-y-1.5 px-4 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-1">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] sm:gap-x-4 sm:text-[11px]"
          aria-label="Footer links"
        >
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              trackEvent('contact_open')
              onContact()
            }}
          >
            <IconContact />
            <span>Contact</span>
          </button>
          <a
            className={itemCls}
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackExternalClick('support', SUPPORT_URL)
              trackEvent('support_click')
            }}
          >
            <IconHeart />
            <span>Support</span>
          </a>
          <a
            className={itemCls}
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackExternalClick('github', GITHUB_URL)
              trackEvent('github_click')
            }}
          >
            <IconGitHub />
            <span>GitHub</span>
          </a>
          <button
            type="button"
            className={itemCls}
            onClick={() => {
              trackEvent('privacy_click')
              onPrivacy()
            }}
          >
            <IconShield />
            <span>Privacy</span>
          </button>
          <button type="button" className={itemCls} onClick={onAbout}>
            <IconInfo />
            <span className="tabular-nums">{APP_VERSION_LABEL}</span>
          </button>
        </nav>
      </div>
    </footer>
  )
}
