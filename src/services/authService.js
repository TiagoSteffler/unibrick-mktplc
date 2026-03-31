import { ref } from 'vue'
import {
  GoogleAuthProvider,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../firebase/config'

const MOCK_USER_KEY = 'marketplace_mock_user'
const DOMAIN_PLACEHOLDER = 'example.edu'

function parseAllowedLoginDomains(rawValue) {
  const normalized = String(rawValue || '').trim().toLowerCase()

  if (!normalized) {
    return []
  }

  const uniqueDomains = new Set(
    normalized
      .split(/[;,\s]+/)
      .map((value) => value.replace(/^@+/, '').trim())
      .filter(Boolean),
  )

  return Array.from(uniqueDomains)
}

const configuredLoginDomains = parseAllowedLoginDomains(import.meta.env.VITE_ALLOWED_LOGIN_DOMAIN)

export const authState = ref(null)
export const authReady = ref(false)
export const authError = ref('')
export const allowedLoginDomains = configuredLoginDomains.length
  ? configuredLoginDomains
  : [DOMAIN_PLACEHOLDER]
export const allowedLoginDomainsText = allowedLoginDomains
  .map((domain) => `@${domain}`)
  .join(', ')
export const isLoginDomainRestrictionEnabled = configuredLoginDomains.length > 0

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

function getFriendlyAuthErrorMessage(error) {
  const code = String(error?.code || '')

  if (code === 'auth/invalid-action-code') {
    return 'Acao de login invalida. Verifique dom\u00ednios autorizados no Firebase Authentication e tente novamente.'
  }

  if (code === 'auth/unauthorized-domain') {
    return 'O dominio atual nao esta autorizado no Firebase Authentication.'
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Ative o login com Google no Firebase Authentication.'
  }

  if (code === 'auth/invalid-api-key') {
    return 'A chave da API do Firebase parece invalida.'
  }

  if (code === 'auth/network-request-failed') {
    return 'Falha de rede ao falar com o Firebase. Tente novamente.'
  }

  if (code === 'auth/popup-blocked') {
    return 'O navegador bloqueou o popup de login. Permita popups para este site e tente novamente.'
  }

  return error instanceof Error
    ? error.message
    : 'Nao foi possivel concluir a autenticacao com Google.'
}

function getEmailDomain(email) {
  const normalized = String(email || '').trim().toLowerCase()
  const atIndex = normalized.lastIndexOf('@')

  if (atIndex < 0) {
    return ''
  }

  return normalized.slice(atIndex + 1)
}

function shouldRejectByDomain(email) {
  if (!isLoginDomainRestrictionEnabled) {
    return false
  }

  return !configuredLoginDomains.includes(getEmailDomain(email))
}

function getDomainRestrictionMessage() {
  if (configuredLoginDomains.length === 1) {
    return `Use um email do dominio @${configuredLoginDomains[0]}.`
  }

  return `Use um email de um dos dominios permitidos: ${allowedLoginDomainsText}.`
}

async function applyDomainRestrictionOrSignOut(user) {
  if (!shouldRejectByDomain(user?.email)) {
    return mapUser(user)
  }

  authError.value = getDomainRestrictionMessage()

  try {
    await signOut(auth)
  } catch {
    // No-op: user is blocked by domain validation anyway.
  }

  authState.value = null
  return null
}

export function clearAuthError() {
  authError.value = ''
}

export function initAuth() {
  if (initPromise) {
    return initPromise
  }

  initPromise = new Promise((resolve) => {
    if (isFirebaseConfigured && auth) {
      onAuthStateChanged(auth, async (user) => {
        if (user && shouldRejectByDomain(user.email)) {
          await applyDomainRestrictionOrSignOut(user)
          authReady.value = true
          resolve(authState.value)
          return
        }

        if (user) {
          clearAuthError()
        }

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
    clearAuthError()

    const provider = new GoogleAuthProvider()
    const providerParams = {
      prompt: 'select_account',
    }

    // The hd parameter supports a single domain hint only.
    if (isLoginDomainRestrictionEnabled && configuredLoginDomains.length === 1) {
      providerParams.hd = configuredLoginDomains[0]
    }

    provider.setCustomParameters(providerParams)

    try {
      const result = await signInWithPopup(auth, provider)
      const validatedUser = await applyDomainRestrictionOrSignOut(result.user)

      authState.value = validatedUser

      if (validatedUser) {
        clearAuthError()
      }

      return validatedUser
    } catch (err) {
      authError.value = getFriendlyAuthErrorMessage(err)
      return null
    }
  }

  clearAuthError()

  const mockDomain = isLoginDomainRestrictionEnabled
    ? configuredLoginDomains[0]
    : 'marketplace.local'

  const mockUser = {
    uid: 'mock-user-1',
    displayName: 'Usuario Demo',
    email: `demo@${mockDomain}`,
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

export async function deleteAuthenticatedUser() {
  if (isFirebaseConfigured && auth) {
    const currentUser = auth.currentUser

    if (!currentUser) {
      throw new Error('Nao foi possivel validar a sessao para excluir a conta.')
    }

    try {
      await deleteUser(currentUser)
    } catch (err) {
      if (err?.code === 'auth/requires-recent-login') {
        const provider = new GoogleAuthProvider()
        await reauthenticateWithPopup(currentUser, provider)
        await deleteUser(currentUser)
      } else {
        throw err
      }
    }

    authState.value = null
    return
  }

  authState.value = null
  saveMockUser(null)
}

export function updateAuthenticatedUserProfile(payload = {}) {
  if (!authState.value) {
    return null
  }

  authState.value = {
    ...authState.value,
    ...payload,
  }

  if (!isFirebaseConfigured || !auth) {
    saveMockUser(authState.value)
  }

  return authState.value
}
