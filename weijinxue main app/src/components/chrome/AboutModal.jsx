import ChromeModal from './ChromeModal.jsx'
import { APP_RELEASE_DATE, APP_VERSION_LABEL, RELEASE_HISTORY } from '../../config/appMeta.js'

/** @param {{ open: boolean, onClose: () => void }} props */
export default function AboutModal({ open, onClose }) {
  return (
    <ChromeModal open={open} title="About" onClose={onClose}>
      <div className="space-y-3 text-xs leading-relaxed text-espresso">
        <div>
          <p className="font-semibold tracking-widest text-[#D4A843]">WEIJINXUE</p>
          <p className="text-[11px] text-muted">为进学</p>
        </div>
        <p className="text-[11px] text-muted">
          <span className="text-espresso">Version:</span> {APP_VERSION_LABEL}
          <br />
          <span className="text-espresso">Release date:</span> {APP_RELEASE_DATE}
        </p>
        <p className="text-[11px] text-ink/95">
          Weijinxue is a free, open-source Mandarin learning app for English speakers, built around reading,
          typing, flashcards, quizzes, and AI conversation.
        </p>
        <div className="space-y-4 border-t border-taupe/60 pt-3">
          {RELEASE_HISTORY.map((release, index) => (
            <div key={release.version}>
              {index > 0 ? <hr className="mb-4 border-taupe/40" aria-hidden /> : null}
              <p className="text-[11px] text-muted">
                <span className="text-espresso">Version:</span> {release.versionLabel}
                <span className="mx-1.5 text-taupe/50">·</span>
                <span className="text-espresso">Release date:</span> {release.releaseDate}
              </p>
              {release.title ? (
                <p className="mt-1.5 text-[11px] font-medium text-ink/95">{release.title}</p>
              ) : null}
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-[11px] text-muted">
                {release.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </ChromeModal>
  )
}
