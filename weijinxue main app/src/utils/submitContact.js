import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'

/**
 * @param {{ category: string, name: string, email: string, message: string }} payload
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
export async function submitContactForm({ category, name, email, message }) {
  try {
    await addDoc(collection(db, 'contact_submissions'), {
      category,
      name: name || null,
      email: email || null,
      message,
      createdAt: serverTimestamp(),
    })
    return { ok: true, message: 'Message sent. Thank you!' }
  } catch (err) {
    console.error('Contact submit error:', err)
    return { ok: false, message: 'Failed to send. Please try again.' }
  }
}
