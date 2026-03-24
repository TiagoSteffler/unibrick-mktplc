import { ref } from 'vue'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../firebase/config'

const MOCK_USER_KEY = 'marketplace_mock_user'

export const authState = ref(null)
export const authReady = ref(false)

let initPromise = null

function mapUser(user) {
  if (!user) {
    return null
  }

  return {
    uid: user.uid,
    displayName: user.displayName || 'Usuario',
    email: user.email || '',
    photoURL: user.photoURL || '',
  }
}

function loadMockUser() {
  const raw = localStorage.getItem(MOCK_USER_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(MOCK_USER_KEY)
    return null
  }
}

function saveMockUser(user) {
  if (user) {
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user))
    return
  }

  localStorage.removeItem(MOCK_USER_KEY)
}

export function initAuth() {
  if (initPromise) {
    return initPromise
  }

  initPromise = new Promise((resolve) => {
    if (isFirebaseConfigured && auth) {
      onAuthStateChanged(auth, (user) => {
        authState.value = mapUser(user)
        authReady.value = true
        resolve(authState.value)
      })
      return
    }

    authState.value = loadMockUser()
    authReady.value = true
    resolve(authState.value)
  })

  return initPromise
}

export async function waitForAuthInit() {
  if (!initPromise) {
    await initAuth()
    return
  }

  await initPromise
}

export function getCurrentUser() {
  return authState.value
}

export async function signInWithGoogle() {
  if (isFirebaseConfigured && auth) {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    authState.value = mapUser(result.user)
    return authState.value
  }

  const mockUser = {
    uid: 'mock-user-1',
    displayName: 'Usuario Demo',
    email: 'demo@marketplace.local',
    photoURL: '',
  }

  authState.value = mockUser
  saveMockUser(mockUser)
  return mockUser
}

export async function signOutUser() {
  if (isFirebaseConfigured && auth) {
    await signOut(auth)
    authState.value = null
    return
  }

  authState.value = null
  saveMockUser(null)
}
