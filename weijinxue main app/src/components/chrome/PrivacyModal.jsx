import ChromeModal from './ChromeModal.jsx'

/** @param {{ open: boolean, onClose: () => void }} props */
export default function PrivacyModal({ open, onClose }) {
  return (
    <ChromeModal open={open} title="Privacy" onClose={onClose}>
      <div className="space-y-3 text-[11px] leading-relaxed text-espresso">
        <p className="font-medium text-ink">Privacy policy coming soon</p>
        <p className="text-muted">
          Weijinxue uses Firebase Authentication and Firestore to support accounts and save learning progress.
          A full privacy policy will be added before broader public launch.
        </p>
        <p className="text-muted">
          <span className="font-medium text-ink">Yǔbàn AI (bring your own key):</span> If you add a Groq or
          Anthropic API key, it is stored only in your browser (localStorage) and sent directly to that
          provider when you chat. We do not store your API keys in Firebase, analytics, or our servers.
        </p>
      </div>
    </ChromeModal>
  )
}
