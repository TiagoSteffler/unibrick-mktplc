import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

function normalizeStorageBucket(value) {
  const raw = String(value || '').trim()

  if (!raw) {
    return ''
  }

  const withoutGsProtocol = raw.replace(/^gs:\/\//i, '').trim()

  // Aceita URLs comuns do Firebase Storage e extrai apenas o bucket real.
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsedUrl = new URL(raw)
      const host = String(parsedUrl.hostname || '').trim().toLowerCase()
      const pathParts = String(parsedUrl.pathname || '')
        .split('/')
        .filter(Boolean)

      if (host === 'firebasestorage.googleapis.com') {
        const bucketMarkerIndex = pathParts.indexOf('b')

        if (bucketMarkerIndex >= 0 && pathParts[bucketMarkerIndex + 1]) {
          return pathParts[bucketMarkerIndex + 1].trim()
        }
      }

      if (host === 'storage.googleapis.com' && pathParts[0]) {
        return pathParts[0].trim()
      }

      if (host.endsWith('.appspot.com') || host.endsWith('.firebasestorage.app')) {
        return host
      }
    } catch {
      // Fallback para parsing textual abaixo.
    }
  }

  const normalized = withoutGsProtocol.replace(/^https?:\/\//i, '')
  const parts = normalized.split('/').filter(Boolean)

  if (!parts.length) {
    return ''
  }

  if (parts[0] === 'firebasestorage.googleapis.com') {
    const bucketMarkerIndex = parts.indexOf('b')

    if (bucketMarkerIndex >= 0 && parts[bucketMarkerIndex + 1]) {
      return parts[bucketMarkerIndex + 1].trim()
    }
  }

  if (parts[0] === 'storage.googleapis.com' && parts[1]) {
    return parts[1].trim()
  }

  return parts[0].trim()
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
