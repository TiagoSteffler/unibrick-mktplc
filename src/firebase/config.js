import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

function normalizeStorageBucket(value) {
  const raw = String(value || '').trim()

  if (!raw) {
    return ''
  }

  return raw
    .replace(/^gs:\/\//i, '')
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .trim()
}

const firebaseProjectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim()
const firebaseStorageBucket = normalizeStorageBucket(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: firebaseProjectId,
  storageBucket: firebaseStorageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean)

let app = null
let auth = null
let db = null
let storage = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  storage = getStorage(app, `gs://${firebaseStorageBucket}`)
}

export {
  app,
  auth,
  db,
  storage,
  isFirebaseConfigured,
  firebaseProjectId,
  firebaseStorageBucket,
}
