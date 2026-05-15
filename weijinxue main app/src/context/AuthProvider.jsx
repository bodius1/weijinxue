import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase.js'
import { mergeLearnedOnLogin } from '../utils/learnedCharacters.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(/** @type {import('firebase/auth').User | null} */ (null))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      // Update UI immediately so Sign In / header reflect the new session without waiting on merge.
      setUser(u)
      setLoading(false)
      if (u) {
        void mergeLearnedOnLogin(u.uid).catch((err) => {
          console.error('mergeLearnedOnLogin failed', err)
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
    await firebaseSignOut(auth)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
    }),
    [user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
