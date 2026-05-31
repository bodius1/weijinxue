import { useEffect, useRef, useState } from 'react'
import ChromeModal from './ChromeModal.jsx'
import { submitContactForm } from '../../utils/submitContact.js'

const CATEGORIES = [
  { id: 'question', label: 'Question' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'bug', label: 'Bug Report' },
  { id: 'account', label: 'Account Help' },
  { id: 'feature', label: 'Feature Request' },
  { id: 'other', label: 'Other' },
]

const inputCls =
  'mt-1 w-full rounded-lg border border-taupe bg-[#0f0e0c] px-2.5 py-1.5 text-xs text-ink placeholder:text-muted outline-none ring-0 focus:border-[#D4A843]/60 focus:ring-1 focus:ring-[#D4A843]/30'
const labelCls = 'block text-[11px] font-medium text-espresso'

/** @param {{ open: boolean, onClose: () => void }} props */
export default function ContactModal({ open, onClose }) {
  const messageRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const [category, setCategory] = useState('question')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(/** @type {null | { type: 'ok' | 'err', text: string }} */ (null))

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setCategory('question')
        setName('')
        setEmail('')
        setMessage('')
        setBusy(false)
        setNotice(null)
      })
    } else {
      const t = window.setTimeout(() => messageRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const onSubmit = async (e) => {
    e.preventDefault()
    const msg = message.trim()
    if (!msg) {
      setNotice({ type: 'err', text: 'Please enter a message.' })
      return
    }
    setBusy(true)
    setNotice(null)
    const r = await submitContactForm({
      category,
      name: name.trim(),
      email: email.trim(),
      message: msg,
    })
    setBusy(false)
    if (r.ok) {
      setNotice({ type: 'ok', text: r.message || 'Sent. Thank you!' })
      setMessage('')
    } else {
      setNotice({ type: 'err', text: r.message })
    }
  }

  return (
    <ChromeModal open={open} title="Contact" onClose={onClose}>
      <p className="text-[11px] leading-relaxed text-muted">
        Choose a category, then send a message.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={[
              'rounded-md border px-2 py-1 text-[10px] font-medium transition sm:text-[11px]',
              category === c.id
                ? 'border-[#D4A843]/70 bg-[#D4A843]/15 text-[#D4A843]'
                : 'border-taupe text-espresso hover:border-[#D4A843]/40 hover:text-[#D4A843]',
            ].join(' ')}
          >
            {c.label}
          </button>
        ))}
      </div>

      <form className="mt-4 space-y-3" onSubmit={onSubmit} noValidate>
        <label className={labelCls}>
          Name <span className="font-normal text-muted">(optional)</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label className={labelCls}>
          Email <span className="font-normal text-muted">(optional, recommended)</span>
          <input
            className={inputCls}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className={labelCls}>
          Message <span className="text-wrong">*</span>
          <textarea
            ref={messageRef}
            className={`${inputCls} min-h-[5.5rem] resize-y`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </label>

        {notice ? (
          <p
            role="status"
            className={[
              'rounded-lg border px-2.5 py-2 text-[11px]',
              notice.type === 'ok' ? 'border-correct/50 text-correct' : 'border-wrong/50 text-wrong',
            ].join(' ')}
          >
            {notice.text}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-taupe px-3 py-1.5 text-[11px] text-espresso transition hover:border-[#D4A843]/50 hover:text-[#D4A843]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg border border-[#D4A843]/60 bg-[#D4A843]/15 px-3 py-1.5 text-[11px] font-semibold text-[#D4A843] transition hover:bg-[#D4A843]/25 disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </ChromeModal>
  )
}
