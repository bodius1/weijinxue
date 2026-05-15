import { useCallback, useEffect, useState } from 'react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase.js'
import { useAuth } from '../context/useAuth.js'

/** @param {{ open: boolean, onClose: () => void }} props */
export default function AuthModal({ open, onClose }) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const [tab, setTab] = useState(/** @type {'signin' | 'signup'} */ ('signin'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setError('')
        setResetSent(false)
        setPassword('')
        setConfirm('')
      })
    }
  }, [open])

  const onGoogle = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
      onClose()
    } catch (e) {
      setError(e?.message ?? 'Google sign-in failed')
    } finally {
      setBusy(false)
    }
  }, [signInWithGoogle, onClose])

  const onEmailSignIn = useCallback(async () => {
    setError('')
    if (!email.trim() || !password) {
      setError('Enter email and password.')
      return
    }
    setBusy(true)
    try {
      await signInWithEmail(email, password)
      onClose()
    } catch (e) {
      setError(e?.message ?? 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }, [email, password, signInWithEmail, onClose])

  const onEmailSignUp = useCallback(async () => {
    setError('')
    if (!email.trim() || !password) {
      setError('Enter email and password.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      await signUpWithEmail(email, password)
      onClose()
    } catch (e) {
      setError(e?.message ?? 'Sign up failed')
    } finally {
      setBusy(false)
    }
  }, [email, password, confirm, signUpWithEmail, onClose])

  const onForgot = useCallback(async () => {
    setError('')
    setResetSent(false)
    if (!email.trim()) {
      setError('Enter your email above, then tap Forgot password.')
      return
    }
    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetSent(true)
    } catch (e) {
      setError(e?.message ?? 'Could not send reset email')
    } finally {
      setBusy(false)
    }
  }, [email])

  const onEmailFormSubmit = useCallback(
    (e) => {
      e.preventDefault()
      if (busy) return
      if (tab === 'signin') void onEmailSignIn()
      else void onEmailSignUp()
    },
    [busy, tab, onEmailSignIn, onEmailSignUp]
  )

  if (!open) return null

  const inputClass =
    'w-full rounded-xl border border-taupe/80 bg-paper/90 px-3 py-2.5 text-sm text-ink placeholder:text-muted outline-none ring-0 transition focus:border-[#D4A843]/80 focus:ring-2 focus:ring-[#D4A843]/25'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={onClose}
    >
      <div
        className="relative z-[101] w-full max-w-md overflow-hidden rounded-2xl border border-taupe/60 bg-parchment shadow-2xl shadow-ink/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-taupe/70 bg-elevated/80 px-4 py-3">
          <h2 id="auth-modal-title" className="text-center text-lg font-semibold text-ink">
            Huaxue account
          </h2>
          <p className="mt-1 text-center text-xs text-espresso">
            Sign in to sync your quiz deck and progress across devices.
          </p>
        </div>

        <div className="flex border-b border-taupe/60">
          <button
            type="button"
            onClick={() => setTab('signin')}
            className={[
              'flex-1 py-2.5 text-sm font-medium transition',
              tab === 'signin'
                ? 'border-b-2 border-[#D4A843] text-ink'
                : 'text-espresso hover:text-ink',
            ].join(' ')}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            className={[
              'flex-1 py-2.5 text-sm font-medium transition',
              tab === 'signup'
                ? 'border-b-2 border-[#D4A843] text-ink'
                : 'text-espresso hover:text-ink',
            ].join(' ')}
          >
            Sign Up
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <button
            type="button"
            disabled={busy}
            onClick={onGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A843] px-4 py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-[#c49a3d] disabled:opacity-50"
          >
            <span className="text-base font-bold leading-none text-ink" aria-hidden>
              G
            </span>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-taupe/80" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted">or</span>
            <span className="h-px flex-1 bg-taupe/80" />
          </div>

          <form className="space-y-4" onSubmit={onEmailFormSubmit} noValidate>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-espresso">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-espresso">Password</span>
                <input
                  type="password"
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </label>
              {tab === 'signup' ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-espresso">Confirm password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </label>
              ) : null}
            </div>

            {error ? <p className="rounded-lg border border-wrong/40 bg-wrong/10 px-3 py-2 text-xs text-wrong">{error}</p> : null}
            {resetSent ? (
              <p className="text-center text-xs text-correct">Check your inbox for a reset link.</p>
            ) : null}

            {tab === 'signin' ? (
              <>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl border border-[#D4A843]/70 bg-transparent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#D4A843]/12 disabled:opacity-50"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onForgot}
                  className="w-full text-center text-xs font-medium text-[#D4A843] underline-offset-2 hover:underline"
                >
                  Forgot password?
                </button>
              </>
            ) : (
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl border border-[#D4A843]/70 bg-transparent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#D4A843]/12 disabled:opacity-50"
              >
                Create Account
              </button>
            )}
          </form>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-xs text-muted hover:text-espresso"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
