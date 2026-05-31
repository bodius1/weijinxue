import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase.js'
import { mergeLearnedOnLogin } from '../utils/learnedCharacters.js'
import { ensureUserProfile } from '../utils/studyStatsFirestore.js'
import { trackEvent } from '../utils/analytics.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(/** @type {import('firebase/auth').User | null} */ (null))
  const [loading, setLoading] = useState(true)
  /** Bumps when auth profile fields change in place (e.g. displayName) so context consumers re-render. */
  const [profileRev, setProfileRev] = useState(0)
  const lastUidRef = useRef(/** @type {string | null} */ (null))

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const prevUid = lastUidRef.current
      const nextUid = u?.uid ?? null
      lastUidRef.current = nextUid

      setUser(u)
      setLoading(false)
      if (u && !prevUid) {
        const method =
          u.providerData[0]?.providerId === 'google.com'
            ? 'google'
            : u.providerData[0]?.providerId === 'password'
              ? 'email'
              : 'other'
        trackEvent('sign_in', { method })
      }
      if (u) {
        void mergeLearnedOnLogin(u.uid).catch((err) => {
          console.error('mergeLearnedOnLogin failed', err)
        })
        void ensureUserProfile(u).catch((err) => {
          console.warn('ensureUserProfile failed', err)
        })
      }
    })
    return () => unsub()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider)
  }, [])

  const signInWithEmail = useCallback(async (email, password) => {
    await signInWithEmailAndPassword(auth, email.trim(), password)
  }, [])

  const signUpWithEmail = useCallback(async (email, password) => {
    await createUserWithEmailAndPassword(auth, email.trim(), password)
  }, [])

  const signOut = useCallback(async () => {
    trackEvent('sign_out')
    await firebaseSignOut(auth)
  }, [])

  const updateDisplayName = useCallback(async (displayName) => {
    const u = auth.currentUser
    if (!u) throw new Error('Not signed in')
    const trimmed = String(displayName ?? '').trim().slice(0, 128)
    const next = trimmed.length > 0 ? trimmed : null
    await updateProfile(u, { displayName: next })
    await reload(u)
    setProfileRev((r) => r + 1)
    const fresh = auth.currentUser
    if (fresh) {
      void ensureUserProfile(fresh).catch((err) => {
        console.warn('ensureUserProfile after display name', err)
      })
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      updateDisplayName,
    }),
    [user, loading, profileRev, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, updateDisplayName],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
