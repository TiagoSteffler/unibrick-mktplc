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
import { clearUserAccessCache, resolveUserAccess } from './marketplaceService'

const MOCK_USER_KEY = 'marketplace_mock_user'
const DOMAIN_PLACEHOLDER = 'example.edu'
export const AUTH_ERROR_KIND_DOMAIN_RESTRICTED = 'domain-restricted'
export const AUTH_ERROR_KIND_BLACKLISTED = 'blacklisted'
export const AUTH_ERROR_KIND_GENERIC = 'generic'

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
export const authErrorKind = ref('')
export const blockedLoginDomain = ref('')
export const blockedLoginReason = ref('')
export const isAdminSession = ref(false)
export const allowedLoginDomains = configuredLoginDomains.length
  ? configuredLoginDomains
  : [DOMAIN_PLACEHOLDER]
export const allowedLoginDomainsText = allowedLoginDomains
  .map((domain) => `@${domain}`)
  .join(', ')
export const isLoginDomainRestrictionEnabled = configuredLoginDomains.length > 0

let initPromise = null

function resolveUserEmail(user) {
  const primaryEmail = String(user?.email || '').trim().toLowerCase()

  if (primaryEmail) {
    return primaryEmail
  }

  if (!Array.isArray(user?.providerData)) {
    return ''
  }

  for (const providerItem of user.providerData) {
    const candidate = String(providerItem?.email || '').trim().toLowerCase()

    if (candidate) {
      return candidate
    }
  }

  return ''
}

function mapUser(user) {
  if (!user) {
    return null
  }

  const resolvedEmail = resolveUserEmail(user)

  return {
    uid: user.uid,
    displayName: user.displayName || 'Usuário',
    email: resolvedEmail,
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
    return 'Ação de login inválida. Verifique dom\u00ednios autorizados no Firebase Authentication e tente novamente.'
  }

  if (code === 'auth/unauthorized-domain') {
    return 'O domínio atual não está autorizado no Firebase Authentication.'
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Ative o login com Google no Firebase Authentication.'
  }

  if (code === 'auth/invalid-api-key') {
    return 'A chave da API do Firebase parece inválida.'
  }

  if (code === 'auth/network-request-failed') {
    return 'Falha de rede ao falar com o Firebase. Tente novamente.'
  }

  if (code === 'auth/popup-blocked') {
    return 'O navegador bloqueou o popup de login. Permita popups para este site e tente novamente.'
  }

  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a autenticação com Google.'
}

function setAuthError(kind, message, domain = '') {
  authErrorKind.value = kind
  authError.value = String(message || '').trim()
  blockedLoginDomain.value =
    kind === AUTH_ERROR_KIND_DOMAIN_RESTRICTED ? String(domain || '').trim().toLowerCase() : ''
  blockedLoginReason.value =
    kind === AUTH_ERROR_KIND_BLACKLISTED ? String(message || '').trim() : ''
}

function getEmailDomain(email) {
  const normalized = String(email || '').trim().toLowerCase()
  const atIndex = normalized.lastIndexOf('@')

  if (atIndex < 0) {
    return ''
  }

  return normalized.slice(atIndex + 1)
}

export function isLoginEmailAllowed(email) {
  if (!isLoginDomainRestrictionEnabled) {
    return true
  }

  return configuredLoginDomains.includes(getEmailDomain(email))
}

function shouldRejectByDomain(user, access = null) {
  if (!isLoginDomainRestrictionEnabled) {
    return false
  }

  if (access?.isAdmin) {
    return false
  }

  return !isLoginEmailAllowed(resolveUserEmail(user))
}

function getDomainRestrictionMessage(email = '') {
  const attemptedDomain = getEmailDomain(email)

  if (configuredLoginDomains.length === 1) {
    const baseMessage = `Use um email do domínio @${configuredLoginDomains[0]}.`
    return attemptedDomain
      ? `${baseMessage} Domínio recebido: @${attemptedDomain}.`
      : baseMessage
  }

  const baseMessage = `Use um email de um dos domínios permitidos: ${allowedLoginDomainsText}.`
  return attemptedDomain
    ? `${baseMessage} Domínio recebido: @${attemptedDomain}.`
    : baseMessage
}

export function getLoginDomainRestrictionMessage(email = '') {
  return getDomainRestrictionMessage(email)
}

function setDomainRestrictionError(email = '') {
  const attemptedDomain = getEmailDomain(email)
  setAuthError(
    AUTH_ERROR_KIND_DOMAIN_RESTRICTED,
    getDomainRestrictionMessage(email),
    attemptedDomain,
  )
}

export function setAuthErrorMessage(message, kind = AUTH_ERROR_KIND_GENERIC, email = '') {
  const attemptedDomain = kind === AUTH_ERROR_KIND_DOMAIN_RESTRICTED ? getEmailDomain(email) : ''
  setAuthError(kind, message, attemptedDomain)
}

function setBlacklistedError(access = {}) {
  const reason = String(access?.blacklistEntry?.reason || '').trim()
  const message = reason
    ? `Sua conta foi bloqueada pela administração. Motivo: ${reason}`
    : 'Sua conta foi bloqueada pela administração e não pode acessar a plataforma.'

  setAuthError(AUTH_ERROR_KIND_BLACKLISTED, message)
}

async function applyAccessRestrictionsOrSignOut(user) {
  const mappedUser = mapUser(user)
  const resolvedEmail = resolveUserEmail(user)
  const access = mappedUser
    ? await resolveUserAccess(mappedUser, { force: true })
    : { isAdmin: false, isBlacklisted: false, blacklistEntry: null }

  isAdminSession.value = Boolean(access.isAdmin)

  if (!access.isBlacklisted && authErrorKind.value === AUTH_ERROR_KIND_BLACKLISTED) {
    clearAuthError()
  }

  if (access.isBlacklisted) {
    setBlacklistedError(access)
    isAdminSession.value = false
    return mappedUser
  }

  if (shouldRejectByDomain(user, access)) {
    setDomainRestrictionError(resolvedEmail)

    try {
      await signOut(auth)
    } catch {
      // No-op: user is blocked by domain validation anyway.
    }

    authState.value = null
    isAdminSession.value = false
    return null
  }

  return mappedUser
}

export function clearAuthError() {
  authError.value = ''
  authErrorKind.value = ''
  blockedLoginDomain.value = ''
  blockedLoginReason.value = ''
}

export function initAuth() {
  if (initPromise) {
    return initPromise
  }

  initPromise = new Promise((resolve) => {
    if (isFirebaseConfigured && auth) {
      onAuthStateChanged(auth, async (user) => {
        const validatedUser = user ? await applyAccessRestrictionsOrSignOut(user) : null

        if (validatedUser && authErrorKind.value !== AUTH_ERROR_KIND_BLACKLISTED) {
          clearAuthError()
        }

        if (!validatedUser) {
          isAdminSession.value = false
        }

        authState.value = validatedUser
        authReady.value = true
        resolve(authState.value)
      })
      return
    }

    authState.value = loadMockUser()

    refreshCurrentUserAccess(authState.value, { force: true })
      .catch(() => {
        isAdminSession.value = false
      })
      .finally(() => {
        authReady.value = true
        resolve(authState.value)
      })
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

export async function refreshCurrentUserAccess(user = authState.value, options = {}) {
  if (!user) {
    isAdminSession.value = false
    return {
      isAdmin: false,
      isBlacklisted: false,
      blacklistEntry: null,
    }
  }

  const access = await resolveUserAccess(user, { force: Boolean(options.force) })
  isAdminSession.value = Boolean(access.isAdmin)
  return access
}

export async function signInWithGoogle() {
  if (isFirebaseConfigured && auth) {
    clearAuthError()

    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })

    try {
      const result = await signInWithPopup(auth, provider)
      const validatedUser = await applyAccessRestrictionsOrSignOut(result.user)

      authState.value = validatedUser

      if (validatedUser && authErrorKind.value !== AUTH_ERROR_KIND_BLACKLISTED) {
        clearAuthError()
      }

      return validatedUser
    } catch (err) {
      setAuthError(AUTH_ERROR_KIND_GENERIC, getFriendlyAuthErrorMessage(err))
      return null
    }
  }

  clearAuthError()

  const mockDomain = isLoginDomainRestrictionEnabled
    ? configuredLoginDomains[0]
    : 'marketplace.local'

  const mockUser = {
    uid: 'mock-user-1',
    displayName: 'Usuário Demo',
    email: `demo@${mockDomain}`,
    photoURL: '',
  }

  authState.value = mockUser
  saveMockUser(mockUser)
  await refreshCurrentUserAccess(mockUser, { force: true })
  return mockUser
}

export async function signOutUser() {
  if (isFirebaseConfigured && auth) {
    await signOut(auth)
    authState.value = null
    isAdminSession.value = false
    clearAuthError()
    clearUserAccessCache()
    return
  }

  authState.value = null
  isAdminSession.value = false
  clearAuthError()
  clearUserAccessCache()
  saveMockUser(null)
}

export async function deleteAuthenticatedUser() {
  if (isFirebaseConfigured && auth) {
    const currentUser = auth.currentUser

    if (!currentUser) {
      throw new Error('Não foi possível validar a sessão para excluir a conta.')
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
    isAdminSession.value = false
    clearUserAccessCache()
    return
  }

  authState.value = null
  isAdminSession.value = false
  clearUserAccessCache()
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

  refreshCurrentUserAccess(authState.value, { force: true }).catch(() => {
    isAdminSession.value = false
  })

  return authState.value
}
