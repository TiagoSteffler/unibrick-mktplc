import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getIdTokenResult } from 'firebase/auth'
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import {
  app,
  auth,
  db,
  firebaseProjectId,
  firebaseStorageBucket,
  isFirebaseConfigured,
  storage,
} from '../firebase/config'

const EXTRA_PRODUCTS_KEY = 'marketplace_extra_products'
const USER_PROFILE_KEY = 'marketplace_user_profiles'
const PRODUCTS_COLLECTION = 'products'
const USER_PROFILES_COLLECTION = 'user_profiles'
const ADMIN_USERS_COLLECTION = 'admin_users'
const BLACKLIST_COLLECTION = 'blacklist'
const HOME_MESSAGES_COLLECTION = 'home_messages'
const HOME_MESSAGE_DOC_ID = 'home_top_message'
const MIN_PRODUCT_PHOTOS = 1
const MAX_PRODUCT_PHOTOS = 5
const MAX_PRODUCT_PRICE = 9999.99
const PRODUCT_CACHE_TTL = 5 * 60 * 1000 // 5 minutos
const ACCESS_CACHE_TTL = 60 * 1000
const ADMIN_DOMAIN = 'gmail.com'
const BLACKLIST_USERS_KEY = 'marketplace_blacklist_users'
const ADMIN_USERS_KEY = 'marketplace_admin_emails'
const HOME_MESSAGE_KEY = 'marketplace_home_message'

const configuredAdminEmails = parseAdminEmails(
  `${import.meta.env.VITE_ADMIN_EMAIL || ''},${import.meta.env.VITE_ADMIN_EMAILS || ''}`,
)

// Cache em memória para produtos
const productCache = new Map()
const accessCache = new Map()

const seedSellers = {
  'seller-1': {
    id: 'seller-1',
    name: 'Loja Brick Sul',
    photoURL: '',
    city: 'Santa Maria',
    joinedAt: '2024-02-10',
    about: 'Especialista em kits de montagem para iniciantes e colecionadores.',
  },
  'seller-2': {
    id: 'seller-2',
    name: 'Brick Artesanal',
    photoURL: '',
    city: 'Porto Alegre',
    joinedAt: '2023-11-01',
    about: 'Pecas raras e miniaturas para projetos criativos.',
  },
}

const seedProducts = []

function safeRead(key, fallback) {
  const raw = localStorage.getItem(key)
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(key)
    return fallback
  }
}

function safeWrite(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function getEmailDomain(email) {
  const normalized = normalizeEmail(email)
  const atIndex = normalized.lastIndexOf('@')

  if (atIndex < 0) {
    return ''
  }

  return normalized.slice(atIndex + 1)
}

function isAdminDomainEmail(email) {
  return getEmailDomain(email) === ADMIN_DOMAIN
}

function parseAdminEmails(rawValue) {
  const values = String(rawValue || '')
    .split(/[;,\s]+/)
    .map((value) => normalizeEmail(value))
    .filter((value) => value.includes('@'))
    .filter((value) => isAdminDomainEmail(value))

  return Array.from(new Set(values))
}

function readLocalAdminEmails() {
  const stored = safeRead(ADMIN_USERS_KEY, [])

  if (!Array.isArray(stored)) {
    return [...configuredAdminEmails]
  }

  const fromStorage = stored
    .map((item) => {
      if (typeof item === 'string') {
        return normalizeEmail(item)
      }

      if (item && typeof item === 'object') {
        return normalizeEmail(item.email)
      }

      return ''
    })
    .filter((email) => isAdminDomainEmail(email))

  return Array.from(new Set([...configuredAdminEmails, ...fromStorage]))
}

function readLocalBlacklist() {
  const stored = safeRead(BLACKLIST_USERS_KEY, [])
  return Array.isArray(stored) ? stored : []
}

function saveLocalBlacklist(entries) {
  safeWrite(BLACKLIST_USERS_KEY, entries)
}

function normalizeBlacklistEntry(entry = {}) {
  const uid = String(entry.uid || '').trim()
  const email = normalizeEmail(entry.email)
  const id = String(entry.id || uid || email || '').trim()

  if (!id) {
    return null
  }

  return {
    id,
    uid,
    email,
    reason: String(entry.reason || '').trim(),
    active: entry.active !== false,
    bannedAt: String(entry.bannedAt || new Date().toISOString()),
    bannedByUid: String(entry.bannedByUid || '').trim(),
    bannedByEmail: normalizeEmail(entry.bannedByEmail),
  }
}

function getAccessCacheKey(user) {
  const uid = String(user?.uid || '').trim()
  const email = normalizeEmail(user?.email)
  return uid || email
}

function getCachedAccess(user) {
  const cacheKey = getAccessCacheKey(user)

  if (!cacheKey) {
    return null
  }

  const cached = accessCache.get(cacheKey)

  if (!cached) {
    return null
  }

  const isExpired = Date.now() - cached.timestamp > ACCESS_CACHE_TTL

  if (isExpired) {
    accessCache.delete(cacheKey)
    return null
  }

  return cached.data
}

function setCachedAccess(user, data) {
  const cacheKey = getAccessCacheKey(user)

  if (!cacheKey) {
    return
  }

  accessCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  })
}

function clearCachedAccess(user = null) {
  if (!user) {
    accessCache.clear()
    return
  }

  const cacheKey = getAccessCacheKey(user)

  if (!cacheKey) {
    return
  }

  accessCache.delete(cacheKey)
}

function parseHomeMessageTemplate(rawTemplate) {
  const raw = String(rawTemplate || '').trim()

  if (!raw) {
    return null
  }

  const titleMatch = raw.match(/\[TITULO\]\s*(.+)/i)
  const messageMatch = raw.match(/\[MENSAGEM\]\s*([\s\S]+)/i)
  const title = String(titleMatch?.[1] || '').trim()
  const message = String(messageMatch?.[1] || '').trim()

  if (!title && !message) {
    return null
  }

  return {
    title,
    message,
    enabled: true,
    source: 'template',
  }
}

function normalizeHomeMessagePayload(payload = {}) {
  const title = String(payload.title || '').trim().slice(0, 120)
  const message = String(payload.message || '').trim().slice(0, 1500)
  const enabled = Boolean(payload.enabled !== false && (title || message))

  return {
    title,
    message,
    enabled,
    updatedAt: String(payload.updatedAt || new Date().toISOString()),
    updatedByUid: String(payload.updatedByUid || '').trim(),
    updatedByEmail: normalizeEmail(payload.updatedByEmail),
  }
}

function getCachedProduct(productId) {
  const cached = productCache.get(productId)
  if (!cached) {
    return null
  }

  const isExpired = Date.now() - cached.timestamp > PRODUCT_CACHE_TTL
  if (isExpired) {
    productCache.delete(productId)
    return null
  }

  return cached.data
}

function setCachedProduct(productId, product) {
  productCache.set(productId, {
    data: product,
    timestamp: Date.now(),
  })
}

function invalidateProductCache(productId) {
  productCache.delete(productId)
}

async function getUserProfileFromFirestore(userId) {
  if (!isFirebaseConfigured || !db) {
    return null
  }

  try {
    const userProfileRef = doc(db, USER_PROFILES_COLLECTION, userId)
    const snapshot = await getDoc(userProfileRef)

    if (!snapshot.exists()) {
      return null
    }

    return snapshot.data()
  } catch {
    return null
  }
}

function isActiveAdminDocument(documentData, userEmail = '') {
  if (!documentData || documentData.active === false) {
    return false
  }

  const normalizedUserEmail = normalizeEmail(userEmail)
  const adminEmail = normalizeEmail(
    documentData.emailLowercase || documentData.email || documentData.adminEmail,
  )

  if (!adminEmail) {
    return true
  }

  return adminEmail === normalizedUserEmail
}

async function hasAdminDocumentInFirestore(user) {
  if (!isFirebaseConfigured || !db) {
    return false
  }

  const uid = String(user?.uid || '').trim()
  const email = normalizeEmail(user?.email)

  if (uid) {
    try {
      const byUid = await getDoc(doc(db, ADMIN_USERS_COLLECTION, uid))

      if (byUid.exists() && isActiveAdminDocument(byUid.data(), email)) {
        return true
      }
    } catch {
      // No-op: fallback checks below.
    }
  }

  if (email) {
    try {
      const byEmailDoc = await getDoc(doc(db, ADMIN_USERS_COLLECTION, email))

      if (byEmailDoc.exists() && isActiveAdminDocument(byEmailDoc.data(), email)) {
        return true
      }
    } catch {
      // No-op: fallback checks below.
    }

    try {
      const byEmailLowercase = await getDocs(
        query(collection(db, ADMIN_USERS_COLLECTION), where('emailLowercase', '==', email), limit(1)),
      )

      if (!byEmailLowercase.empty && isActiveAdminDocument(byEmailLowercase.docs[0].data(), email)) {
        return true
      }
    } catch {
      // No-op: fallback checks below.
    }

    try {
      const byEmail = await getDocs(
        query(collection(db, ADMIN_USERS_COLLECTION), where('email', '==', email), limit(1)),
      )

      if (!byEmail.empty && isActiveAdminDocument(byEmail.docs[0].data(), email)) {
        return true
      }
    } catch {
      // No-op: fallback checks below.
    }
  }

  return false
}

async function hasAdminClaimInCurrentSession(user) {
  if (!isFirebaseConfigured || !auth?.currentUser || !user?.uid) {
    return false
  }

  if (auth.currentUser.uid !== user.uid) {
    return false
  }

  try {
    const tokenResult = await getIdTokenResult(auth.currentUser, true)
    const claims = tokenResult?.claims || {}
    const role = String(claims.role || '').trim().toLowerCase()
    const roles = Array.isArray(claims.roles)
      ? claims.roles.map((item) => String(item || '').trim().toLowerCase())
      : []

    return Boolean(claims.admin === true || role === 'admin' || roles.includes('admin'))
  } catch {
    return false
  }
}

function findLocalBlacklistEntry(user) {
  const uid = String(user?.uid || '').trim()
  const email = normalizeEmail(user?.email)

  const normalizedEntries = readLocalBlacklist()
    .map((entry) => normalizeBlacklistEntry(entry))
    .filter(Boolean)

  return (
    normalizedEntries.find((entry) => {
      if (!entry.active) {
        return false
      }

      if (uid && (entry.uid === uid || entry.id === uid)) {
        return true
      }

      if (email && (entry.email === email || entry.id === email)) {
        return true
      }

      return false
    }) || null
  )
}

async function findFirestoreBlacklistEntry(user) {
  if (!isFirebaseConfigured || !db) {
    return null
  }

  const uid = String(user?.uid || '').trim()
  const email = normalizeEmail(user?.email)

  const candidates = []

  if (uid) {
    candidates.push(doc(db, BLACKLIST_COLLECTION, uid))
  }

  if (email) {
    candidates.push(doc(db, BLACKLIST_COLLECTION, email))
  }

  for (const candidate of candidates) {
    try {
      const snapshot = await getDoc(candidate)

      if (!snapshot.exists()) {
        continue
      }

      const normalizedEntry = normalizeBlacklistEntry({ id: snapshot.id, ...snapshot.data() })

      if (normalizedEntry?.active) {
        return normalizedEntry
      }
    } catch {
      // No-op: continue searching by other keys.
    }
  }

  if (uid) {
    try {
      const byUid = await getDocs(
        query(collection(db, BLACKLIST_COLLECTION), where('uid', '==', uid), limit(1)),
      )

      if (!byUid.empty) {
        const normalizedEntry = normalizeBlacklistEntry({
          id: byUid.docs[0].id,
          ...byUid.docs[0].data(),
        })

        if (normalizedEntry?.active) {
          return normalizedEntry
        }
      }
    } catch {
      // No-op: continue fallback by email.
    }
  }

  if (email) {
    try {
      const byEmailLowercase = await getDocs(
        query(collection(db, BLACKLIST_COLLECTION), where('emailLowercase', '==', email), limit(1)),
      )

      if (!byEmailLowercase.empty) {
        const normalizedEntry = normalizeBlacklistEntry({
          id: byEmailLowercase.docs[0].id,
          ...byEmailLowercase.docs[0].data(),
        })

        if (normalizedEntry?.active) {
          return normalizedEntry
        }
      }
    } catch {
      // No-op: continue fallback by original email field.
    }

    try {
      const byEmail = await getDocs(
        query(collection(db, BLACKLIST_COLLECTION), where('email', '==', email), limit(1)),
      )

      if (!byEmail.empty) {
        const normalizedEntry = normalizeBlacklistEntry({
          id: byEmail.docs[0].id,
          ...byEmail.docs[0].data(),
        })

        if (normalizedEntry?.active) {
          return normalizedEntry
        }
      }
    } catch {
      // No-op: returning null is expected when there is no ban.
    }
  }

  return null
}

export async function resolveUserAccess(user, options = {}) {
  const normalizedUser = {
    uid: String(user?.uid || '').trim(),
    email: normalizeEmail(user?.email),
  }

  if (!normalizedUser.uid && !normalizedUser.email) {
    return {
      isAdmin: false,
      isBlacklisted: false,
      blacklistEntry: null,
    }
  }

  if (!options.force) {
    const cached = getCachedAccess(normalizedUser)

    if (cached) {
      return cached
    }
  }

  const localAdminEmails = readLocalAdminEmails()
  const canBeAdmin = isAdminDomainEmail(normalizedUser.email)
  let isAdmin = false

  if (canBeAdmin) {
    isAdmin = localAdminEmails.includes(normalizedUser.email)

    if (!isAdmin) {
      isAdmin = await hasAdminDocumentInFirestore(normalizedUser)
    }

    if (!isAdmin) {
      isAdmin = await hasAdminClaimInCurrentSession(normalizedUser)
    }
  }

  const localBlacklistEntry = findLocalBlacklistEntry(normalizedUser)
  const firestoreBlacklistEntry = localBlacklistEntry
    ? null
    : await findFirestoreBlacklistEntry(normalizedUser)
  const blacklistEntry = localBlacklistEntry || firestoreBlacklistEntry

  const resolved = {
    isAdmin,
    isBlacklisted: Boolean(blacklistEntry),
    blacklistEntry,
  }

  setCachedAccess(normalizedUser, resolved)
  return resolved
}

export async function isUserAdmin(user, options = {}) {
  const access = await resolveUserAccess(user, options)
  return access.isAdmin
}

export async function isUserBlacklisted(user, options = {}) {
  const access = await resolveUserAccess(user, options)
  return access.isBlacklisted
}

async function assertAdminUser(user) {
  const access = await resolveUserAccess(user, { force: true })

  if (!access.isAdmin) {
    throw new Error('Acesso restrito ao administrador.')
  }

  return access
}

function normalizeProduct(product) {
  const moderationStatus = normalizeModerationStatus(product.moderationStatus)

  return {
    ...product,
    id: product.id,
    title: product.title || 'Sem título',
    description: product.description || '',
    category: product.category || 'Geral',
    sellerId: product.sellerId || '',
    sellerName: product.sellerName || 'Vendedor',
    sellerPhotoURL: product.sellerPhotoURL || '',
    createdAt: product.createdAt || new Date().toISOString().slice(0, 10),
    price: Number(product.price || 0),
    condition: product.condition || 'usado',
    deliveryOptions: product.deliveryOptions || { delivery: false, retrieval: true },
    retrievalLocation: product.retrievalLocation || '',
    photos: Array.isArray(product.photos) ? product.photos.filter(Boolean) : [],
    moderationStatus,
    moderationReason: String(product.moderationReason || '').trim(),
    moderationUpdatedAt: String(product.moderationUpdatedAt || ''),
    moderationUpdatedByUid: String(product.moderationUpdatedByUid || '').trim(),
    moderationUpdatedByEmail: normalizeEmail(product.moderationUpdatedByEmail),
    reportReason: String(product.reportReason || '').trim(),
    reportedAt: String(product.reportedAt || ''),
    reportedByUid: String(product.reportedByUid || '').trim(),
    reportedByEmail: normalizeEmail(product.reportedByEmail),
    isAdminPost: Boolean(product.isAdminPost),
  }
}

function normalizeModerationStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()

  if (normalized === 'pending' || normalized === 'reported' || normalized === 'rejected') {
    return normalized
  }

  return 'approved'
}

function isProductPubliclyVisible(product) {
  const status = normalizeModerationStatus(product?.moderationStatus)
  return status === 'approved' || status === 'reported'
}

function compareAdminPostPriority(a, b) {
  if (Boolean(a?.isAdminPost) === Boolean(b?.isAdminPost)) {
    return 0
  }

  return a?.isAdminPost ? -1 : 1
}

function normalizePhotoList(photos) {
  if (!Array.isArray(photos)) {
    return []
  }

  return photos.map((item) => String(item || '').trim()).filter(Boolean).slice(0, MAX_PRODUCT_PHOTOS)
}

function validatePhotoCount(photos) {
  if (photos.length < MIN_PRODUCT_PHOTOS) {
    throw new Error('Inclua pelo menos uma foto do produto.')
  }

  if (photos.length > MAX_PRODUCT_PHOTOS) {
    throw new Error(`Envie no máximo ${MAX_PRODUCT_PHOTOS} fotos por produto.`)
  }
}

function validateProductPrice(price) {
  const numericPrice = Number(price)

  if (!Number.isFinite(numericPrice) || numericPrice < 0 || numericPrice > MAX_PRODUCT_PRICE) {
    throw new Error('O preço deve estar entre R$ 0,00 e R$ 9.999,99.')
  }

  return Number(numericPrice.toFixed(2))
}

function getStorageErrorContext(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  const serverResponse = String(error?.serverResponse || '')
  return `${code} ${message} ${serverResponse}`.toLowerCase()
}

function isMissingBucketStorageError(error) {
  const context = getStorageErrorContext(error)
  return (
    context.includes('404') ||
    context.includes('bucket not found') ||
    context.includes('bucket does not exist')
  )
}

function isStorageInfraError(error) {
  const context = getStorageErrorContext(error)
  return (
    context.includes('403') ||
    context.includes('cors') ||
    context.includes('preflight') ||
    context.includes('storage/unauthorized') ||
    context.includes('storage/unknown') ||
    context.includes('network request failed')
  )
}

async function uploadPhotosToStorage(files, user) {
  if (!storage) {
    throw new Error('Storage do Firebase não está configurado.')
  }

  const now = Date.now()
  const uploads = files.slice(0, MAX_PRODUCT_PHOTOS).map(async (file, index) => {
    const extension = String(file.name || 'jpg').split('.').pop() || 'jpg'
    const path = `products/${user.uid}/${now}-${index}.${extension}`

    const uploadWith = async (storageInstance) => {
      const storageRef = ref(storageInstance, path)
      await withTimeout(
        uploadBytes(storageRef, file),
        20000,
        'Tempo limite no upload de imagem para o Storage.',
      )
      return withTimeout(
        getDownloadURL(storageRef),
        10000,
        'Tempo limite ao obter URL da imagem enviada.',
      )
    }

    try {
      return await uploadWith(storage)
    } catch (primaryError) {
      const hasFirestoreDomainBucket = firebaseStorageBucket.endsWith('.firebasestorage.app')
      const fallbackBucket = firebaseProjectId ? `${firebaseProjectId}.appspot.com` : ''
      const shouldRetryWithLegacyBucket =
        hasFirestoreDomainBucket &&
        fallbackBucket &&
        fallbackBucket !== firebaseStorageBucket &&
        app &&
        isMissingBucketStorageError(primaryError)

      if (!shouldRetryWithLegacyBucket) {
        throw primaryError
      }

      const fallbackStorage = getStorage(app, `gs://${fallbackBucket}`)

      try {
        return await uploadWith(fallbackStorage)
      } catch {
        throw primaryError
      }
    }
  })

  try {
    return await Promise.all(uploads)
  } catch (err) {
    if (isMissingBucketStorageError(err)) {
      throw new Error(
        'Falha no upload das imagens: bucket de Storage não encontrado. Verifique VITE_FIREBASE_STORAGE_BUCKET no .env.',
      )
    }

    if (isStorageInfraError(err)) {
      throw new Error(
        'Falha no upload das imagens para o Firebase Storage por permissão/CORS. Verifique regras do Storage e configuração CORS do bucket.',
      )
    }

    throw new Error(
      'Falha no upload das imagens para o Firebase Storage. Verifique o bucket configurado e as regras/CORS do Storage.',
    )
  }
}

function isDataUrlPhoto(photo) {
  return String(photo || '').startsWith('data:')
}

function buildFallbackStorage() {
  const hasFirestoreDomainBucket = firebaseStorageBucket.endsWith('.firebasestorage.app')
  const fallbackBucket = firebaseProjectId ? `${firebaseProjectId}.appspot.com` : ''
  const shouldUseFallback =
    hasFirestoreDomainBucket && fallbackBucket && fallbackBucket !== firebaseStorageBucket && app

  if (!shouldUseFallback) {
    return null
  }

  return getStorage(app, `gs://${fallbackBucket}`)
}

async function deletePhotoFromStorage(photoUrl) {
  if (!String(photoUrl || '').startsWith('http')) {
    return
  }

  const storageTargets = []

  if (storage) {
    storageTargets.push(storage)
  }

  const fallbackStorage = buildFallbackStorage()

  if (fallbackStorage) {
    storageTargets.push(fallbackStorage)
  }

  for (const storageTarget of storageTargets) {
    try {
      await deleteObject(ref(storageTarget, photoUrl))
      return
    } catch {
      // Melhor esforco: mantemos o anúncio consistente mesmo se cleanup falhar.
    }
  }
}

async function deletePhotosFromStorage(photoUrls) {
  const targets = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : []

  if (!targets.length) {
    return
  }

  await Promise.all(targets.map((photoUrl) => deletePhotoFromStorage(photoUrl)))
}

function compareByCreatedAtDesc(a, b) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

function sortProducts(products, sortBy) {
  const items = [...products]

  if (sortBy === 'priceAsc') {
    items.sort((a, b) => a.price - b.price || compareByCreatedAtDesc(a, b))
    return items.sort(compareAdminPostPriority)
  }

  if (sortBy === 'priceDesc') {
    items.sort((a, b) => b.price - a.price || compareByCreatedAtDesc(a, b))
    return items.sort(compareAdminPostPriority)
  }

  items.sort(compareByCreatedAtDesc)
  return items.sort(compareAdminPostPriority)
}

async function resolveViewerAccess(viewer, viewerAccess = null) {
  if (!viewer) {
    return {
      isAdmin: false,
      isBlacklisted: false,
      blacklistEntry: null,
    }
  }

  if (viewerAccess) {
    return viewerAccess
  }

  return resolveUserAccess(viewer)
}

function canViewerAccessProduct(product, viewer, viewerAccess, options = {}) {
  const {
    includeUnapproved = false,
    allowOwnerAccess = false,
    allowAdminAccess = false,
  } = options

  if (includeUnapproved) {
    return true
  }

  if (isProductPubliclyVisible(product)) {
    return true
  }

  if (!viewer) {
    return false
  }

  if (allowOwnerAccess && String(product?.sellerId || '').trim() === String(viewer.uid || '').trim()) {
    return true
  }

  return allowAdminAccess && Boolean(viewerAccess?.isAdmin)
}

function filterProductsByVisibility(products, viewer, viewerAccess, options = {}) {
  return products.filter((product) =>
    canViewerAccessProduct(product, viewer, viewerAccess, options),
  )
}

function getAllProducts() {
  const extra = safeRead(EXTRA_PRODUCTS_KEY, [])
  return [...seedProducts, ...extra].map(normalizeProduct)
}

async function getAllProductsFirestore() {
  if (!isFirebaseConfigured || !db) {
    return getAllProducts()
  }

  const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION))

  return snapshot.docs.map((item) => {
    const data = item.data()
    return normalizeProduct({
      id: item.id,
      ...data,
    })
  })
}

async function getProductByIdFirestore(productId, options = {}) {
  const {
    viewer = null,
    viewerAccess = null,
    includeUnapproved = false,
    allowOwnerAccess = true,
    allowAdminAccess = true,
  } = options
  const resolvedViewerAccess = await resolveViewerAccess(viewer, viewerAccess)

  if (!isFirebaseConfigured || !db) {
    const localProduct = getAllProducts().find((item) => item.id === productId) || null

    if (!localProduct) {
      return null
    }

    return canViewerAccessProduct(localProduct, viewer, resolvedViewerAccess, {
      includeUnapproved,
      allowOwnerAccess,
      allowAdminAccess,
    })
      ? localProduct
      : null
  }

  // Verificar cache primeiro
  const cached = getCachedProduct(productId)
  if (cached) {
    return canViewerAccessProduct(cached, viewer, resolvedViewerAccess, {
      includeUnapproved,
      allowOwnerAccess,
      allowAdminAccess,
    })
      ? cached
      : null
  }

  const snapshot = await getDoc(doc(db, PRODUCTS_COLLECTION, String(productId)))

  if (!snapshot.exists()) {
    return null
  }

  const product = normalizeProduct({
    id: snapshot.id,
    ...snapshot.data(),
  })

  // Armazenar no cache
  setCachedProduct(productId, product)

  return canViewerAccessProduct(product, viewer, resolvedViewerAccess, {
    includeUnapproved,
    allowOwnerAccess,
    allowAdminAccess,
  })
    ? product
    : null
}

async function getSellerPreviewById(sellerId) {
  if (!isFirebaseConfigured || !db) {
    return null
  }

  const sellerProductsQuery = query(
    collection(db, PRODUCTS_COLLECTION),
    where('sellerId', '==', sellerId),
    limit(1),
  )

  const sellerSnapshot = await getDocs(sellerProductsQuery)

  if (sellerSnapshot.empty) {
    return null
  }

  const sample = sellerSnapshot.docs[0].data()
  const profiles = readUserProfiles()
  const sellerProfile = profiles[sellerId] || {}

  return {
    id: sellerId,
    name: sellerProfile.fullName || sample.sellerName || 'Vendedor',
    photoURL: sellerProfile.photoURL || sample.sellerPhotoURL || '',
    city: sellerProfile.hometown || 'Não informado',
    joinedAt:
      sellerProfile.createdAt || sample.createdAt || new Date().toISOString().slice(0, 10),
    about: sellerProfile.aboutMe || 'Não Disponível',
  }
}

function buildFavoriteKey(userId) {
  return `marketplace_favorites_${userId}`
}

function clearFavoritesForUser(userId) {
  if (!userId) {
    return
  }

  localStorage.removeItem(buildFavoriteKey(userId))
}

function removeLocalProductsBySeller(userId) {
  if (!userId) {
    return
  }

  const extra = safeRead(EXTRA_PRODUCTS_KEY, [])
  const removedIds = extra
    .filter((item) => item?.sellerId === userId)
    .map((item) => String(item.id || ''))
    .filter(Boolean)

  if (!removedIds.length) {
    return
  }

  const next = extra.filter((item) => item?.sellerId !== userId)
  safeWrite(EXTRA_PRODUCTS_KEY, next)

  removedIds.forEach((productId) => {
    removeProductFromAllFavorites(productId)
    invalidateProductCache(productId)
  })
}

function removeProductFromAllFavorites(productId) {
  const prefix = 'marketplace_favorites_'

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)

    if (!key || !key.startsWith(prefix)) {
      continue
    }

    const favoriteIds = safeRead(key, [])

    if (!favoriteIds.includes(productId)) {
      continue
    }

    safeWrite(
      key,
      favoriteIds.filter((id) => id !== productId),
    )
  }
}

function getStoredUserProfile(userId) {
  if (!userId) {
    return null
  }

  const profiles = readUserProfiles()
  return profiles[userId] || null
}

function getPreferredUserIdentity(user) {
  if (!user) {
    return {
      displayName: 'Vendedor',
      photoURL: '',
    }
  }

  const stored = getStoredUserProfile(user.uid)
  const normalizedStored = stored ? normalizeUserProfile(stored, user) : null

  return {
    displayName: normalizedStored?.fullName || user.displayName || 'Vendedor',
    photoURL: normalizedStored?.photoURL || '',
  }
}

function toSellerSummary(sellerId, profile, fallback = {}) {
  const now = new Date().toISOString().slice(0, 10)

  return {
    id: sellerId,
    name: String(profile?.fullName || fallback.displayName || fallback.name || 'Vendedor').trim() ||
      'Vendedor',
    photoURL: String(profile?.photoURL || fallback.photoURL || '').trim(),
    city: String(profile?.hometown || fallback.hometown || fallback.city || '').trim() ||
      'Não informado',
    joinedAt: String(profile?.createdAt || fallback.joinedAt || now),
    about: String(profile?.aboutMe || fallback.about || '').trim() || 'Não Disponível',
    universityRole: String(profile?.universityRole || '').trim(),
  }
}

function toMyProfileData(user, normalizedProfile) {
  const now = new Date().toISOString().slice(0, 10)

  return {
    id: user.uid,
    name: normalizedProfile?.fullName || user.displayName || 'Meu Perfil',
    photoURL: normalizedProfile?.photoURL || '',
    city: normalizedProfile?.hometown || 'Não informado',
    joinedAt: normalizedProfile?.createdAt || now,
    about: normalizedProfile?.aboutMe || 'Não Disponível',
    email: normalizedProfile?.email || user.email || '',
    gender: normalizedProfile?.gender || '',
    neighborhood: normalizedProfile?.neighborhood || '',
    hometown: normalizedProfile?.hometown || '',
    universityRole: normalizedProfile?.universityRole || '',
    aboutMe: normalizedProfile?.aboutMe || '',
    fullName: normalizedProfile?.fullName || user.displayName || '',
    createdAt: normalizedProfile?.createdAt || now,
  }
}

function sellerFromUser(user) {
  const registered = getUserProfile(user)

  return toMyProfileData(user, registered)
}

function getSuggestedName(user) {
  if (!user) {
    return ''
  }

  if (user.displayName && user.displayName.trim()) {
    return user.displayName.trim()
  }

  const email = user.email || ''
  const [prefix] = email.split('@')
  return prefix || ''
}

function isProfileComplete(profile) {
  if (!profile) {
    return false
  }

  return Boolean(
    String(profile.fullName || '').trim() &&
      String(profile.gender || '').trim() &&
      String(profile.neighborhood || '').trim() &&
      String(profile.universityRole || '').trim() &&
      String(profile.hometown || '').trim() &&
      String(profile.email || '').trim(),
  )
}

function cacheNormalizedUserProfile(userId, profile) {
  if (!userId || !profile) {
    return
  }

  const profiles = readUserProfiles()
  profiles[userId] = profile
  saveUserProfiles(profiles)
}

function normalizeUserProfile(profile, user) {
  const email = String(profile?.email || user?.email || '').trim()
  const now = new Date().toISOString().slice(0, 10)

  return {
    fullName: String(profile?.fullName || getSuggestedName(user)).trim(),
    gender: String(profile?.gender || '').trim(),
    neighborhood: String(profile?.neighborhood || '').trim(),
    universityRole: String(profile?.universityRole || '').trim(),
    hometown: String(profile?.hometown || '').trim(),
    aboutMe: String(profile?.aboutMe || '')
      .trim()
      .slice(0, 300),
    photoURL: String(profile?.photoURL || '').trim(),
    email,
    createdAt: String(profile?.createdAt || now),
    updatedAt: new Date().toISOString(),
  }
}

function readUserProfiles() {
  return safeRead(USER_PROFILE_KEY, {})
}

function saveUserProfiles(profiles) {
  safeWrite(USER_PROFILE_KEY, profiles)
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage || 'Tempo limite excedido.'))
    }, timeoutMs)

    Promise.resolve(promise)
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((err) => {
        clearTimeout(timeoutId)
        reject(err)
      })
  })
}

async function uploadUserProfilePhoto(photoData, userId) {
  if (!storage) {
    throw new Error('Storage do Firebase não está configurado.')
  }

  // Se não for data URL, retornar como está (já é URL)
  if (!String(photoData || '').startsWith('data:')) {
    return photoData
  }

  // Converter data URL para Blob
  const response = await withTimeout(
    fetch(photoData),
    10000,
    'Tempo limite ao processar a foto de perfil.',
  )
  const blob = await withTimeout(
    response.blob(),
    10000,
    'Tempo limite ao processar a foto de perfil.',
  )

  const path = `user_profiles/${userId}.jpg`
  const storageRef = ref(storage, path)

  try {
    await withTimeout(
      uploadBytes(storageRef, blob),
      15000,
      'Tempo limite no upload da foto de perfil.',
    )
    return withTimeout(
      getDownloadURL(storageRef),
      10000,
      'Tempo limite ao obter URL da foto de perfil.',
    )
  } catch (primaryError) {
    const hasFirestoreDomainBucket = firebaseStorageBucket.endsWith('.firebasestorage.app')
    const fallbackBucket = firebaseProjectId ? `${firebaseProjectId}.appspot.com` : ''
    const shouldRetryWithLegacyBucket =
      hasFirestoreDomainBucket &&
      fallbackBucket &&
      fallbackBucket !== firebaseStorageBucket &&
      app &&
      isMissingBucketStorageError(primaryError)

    if (!shouldRetryWithLegacyBucket) {
      throw primaryError
    }

    const fallbackStorage = getStorage(app, `gs://${fallbackBucket}`)
    const fallbackRef = ref(fallbackStorage, path)

    await withTimeout(
      uploadBytes(fallbackRef, blob),
      15000,
      'Tempo limite no upload da foto de perfil.',
    )
    return withTimeout(
      getDownloadURL(fallbackRef),
      10000,
      'Tempo limite ao obter URL da foto de perfil.',
    )
  }
}

export function getUserProfile(user) {
  if (!user) {
    return null
  }

  const profiles = readUserProfiles()
  const stored = profiles[user.uid] || {}
  return normalizeUserProfile(stored, user)
}

export function isUserProfileComplete(profile) {
  return isProfileComplete(profile)
}

export async function hasCompletedUserProfile(user) {
  if (!user) {
    return false
  }

  const localProfile = getUserProfile(user)

  if (isProfileComplete(localProfile)) {
    return true
  }

  const firestoreProfile = await getUserProfileFromFirestore(user.uid)

  if (!firestoreProfile) {
    return false
  }

  const normalizedFirestoreProfile = normalizeUserProfile(firestoreProfile, user)
  cacheNormalizedUserProfile(user.uid, normalizedFirestoreProfile)

  return isProfileComplete(normalizedFirestoreProfile)
}

export async function saveUserProfile(user, payload) {
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  let processedPhotoURL = String(payload.photoURL || '').trim()

  // Se Firestore está configurado, fazer upload de foto se necessário
  if (isFirebaseConfigured && db && isDataUrlPhoto(processedPhotoURL)) {
    try {
      processedPhotoURL = await withTimeout(
        uploadUserProfilePhoto(processedPhotoURL, user.uid),
        18000,
        'Tempo limite no upload da foto de perfil.',
      )
    } catch (err) {
      console.warn('Falha no upload da foto de perfil. Mantendo foto local em base64.', err)
    }
  }

  const profiles = readUserProfiles()
  const current = profiles[user.uid] || {}
  const merged = {
    ...current,
    ...payload,
    photoURL: processedPhotoURL,
    email: user.email || current.email || '',
  }

  const normalized = normalizeUserProfile(merged, user)
  profiles[user.uid] = normalized
  saveUserProfiles(profiles)

  // Salvar no Firestore também
  if (isFirebaseConfigured && db) {
    const userProfileRef = doc(db, USER_PROFILES_COLLECTION, user.uid)
    const firestorePayload = {
      fullName: normalized.fullName,
      gender: normalized.gender,
      neighborhood: normalized.neighborhood,
      universityRole: normalized.universityRole,
      hometown: normalized.hometown,
      aboutMe: normalized.aboutMe,
      photoURL: normalized.photoURL,
      email: normalized.email,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
    }

    try {
      await withTimeout(
        setDoc(userProfileRef, firestorePayload),
        12000,
        'Tempo limite ao salvar perfil no Firestore.',
      )
    } catch (err) {
      const shouldRetryWithoutInlinePhoto = isDataUrlPhoto(firestorePayload.photoURL)

      if (!shouldRetryWithoutInlinePhoto) {
        // Não falhar se Firestore não funcionar, usar localStorage como fallback
        console.warn('Falha ao salvar perfil no Firestore:', err)
      } else {
        try {
          await withTimeout(
            setDoc(userProfileRef, {
              ...firestorePayload,
              photoURL: '',
            }),
            12000,
            'Tempo limite ao salvar perfil no Firestore.',
          )
          console.warn(
            'Perfil salvo no Firestore sem foto inline porque o documento excedeu o limite permitido.',
            err,
          )
        } catch (retryErr) {
          // Não falhar se Firestore não funcionar, usar localStorage como fallback
          console.warn('Falha ao salvar perfil no Firestore:', retryErr)
        }
      }
    }
  }

  return normalized
}

function parsePriceFilterValue(rawValue) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return null
  }

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue
  }

  const normalized = String(rawValue || '').trim()

  if (!normalized) {
    return null
  }

  const numeric = Number(normalized)

  if (Number.isFinite(numeric)) {
    return numeric
  }

  const digits = normalized.replace(/\D/g, '')

  if (!digits) {
    return 0
  }

  return Number.parseInt(digits, 10) / 100
}

export async function getAvailableCategories(options = {}) {
  const { viewer = null, includeUnapproved = false, viewerAccess = null } = options
  const resolvedViewerAccess = await resolveViewerAccess(viewer, viewerAccess)
  const visibleProducts = filterProductsByVisibility(
    await getAllProductsFirestore(),
    viewer,
    resolvedViewerAccess,
    {
      includeUnapproved,
      allowOwnerAccess: false,
      allowAdminAccess: false,
    },
  )
  const categories = [...new Set(visibleProducts.map((item) => item.category))]
  return categories.sort((a, b) => a.localeCompare(b))
}

export async function searchProducts(filters = {}, options = {}) {
  const {
    query = '',
    category = '',
    minPrice = '',
    maxPrice = '',
    condition = '',
    sortBy = 'recent',
  } = filters

  const {
    viewer = null,
    includeUnapproved = false,
    viewerAccess = null,
  } = options
  const resolvedViewerAccess = await resolveViewerAccess(viewer, viewerAccess)

  const parsedMin = parsePriceFilterValue(minPrice)
  const parsedMax = parsePriceFilterValue(maxPrice)
  const min = parsedMin === null ? Number.NEGATIVE_INFINITY : parsedMin
  const max = parsedMax === null ? Number.POSITIVE_INFINITY : parsedMax
  const term = query.trim().toLowerCase()
  const visibleProducts = filterProductsByVisibility(
    await getAllProductsFirestore(),
    viewer,
    resolvedViewerAccess,
    {
      includeUnapproved,
      allowOwnerAccess: false,
      allowAdminAccess: false,
    },
  )

  const filtered = visibleProducts.filter((product) => {
    const matchName = term ? product.title.toLowerCase().includes(term) : true
    const matchCategory = category ? product.category === category : true
    const matchPrice = product.price >= min && product.price <= max
    const matchCondition = condition ? product.condition === condition : true

    return matchName && matchCategory && matchPrice && matchCondition
  })

  return sortProducts(filtered, sortBy)
}

export async function getFreeProducts(limit = 8, options = {}) {
  const {
    viewer = null,
    includeUnapproved = false,
    viewerAccess = null,
  } = options
  const resolvedViewerAccess = await resolveViewerAccess(viewer, viewerAccess)
  const visibleProducts = filterProductsByVisibility(
    await getAllProductsFirestore(),
    viewer,
    resolvedViewerAccess,
    {
      includeUnapproved,
      allowOwnerAccess: false,
      allowAdminAccess: false,
    },
  )

  return sortProducts(
    visibleProducts.filter((item) => item.price === 0),
    'recent',
  ).slice(0, limit)
}

export async function getRecentProducts(limit = 8, options = {}) {
  const {
    viewer = null,
    includeUnapproved = false,
    viewerAccess = null,
  } = options
  const resolvedViewerAccess = await resolveViewerAccess(viewer, viewerAccess)
  const visibleProducts = filterProductsByVisibility(
    await getAllProductsFirestore(),
    viewer,
    resolvedViewerAccess,
    {
      includeUnapproved,
      allowOwnerAccess: false,
      allowAdminAccess: false,
    },
  )

  return sortProducts(visibleProducts, 'recent').slice(0, limit)
}

export async function getProductById(productId, options = {}) {
  return getProductByIdFirestore(productId, options)
}

export async function getSellerById(sellerId) {
  const seeded = seedSellers[sellerId]

  if (seeded) {
    return {
      ...seeded,
      city: seeded.city || 'Não informado',
      joinedAt: seeded.joinedAt || new Date().toISOString().slice(0, 10),
      about: seeded.about || 'Não Disponível',
    }
  }

  const localProfile = getStoredUserProfile(sellerId)

  if (localProfile) {
    const normalizedLocalProfile = normalizeUserProfile(localProfile, {
      displayName: localProfile.fullName || 'Vendedor',
      email: localProfile.email || '',
      photoURL: localProfile.photoURL || '',
    })

    return toSellerSummary(sellerId, normalizedLocalProfile)
  }

  // Tentar buscar do Firestore
  const firestoreProfile = await getUserProfileFromFirestore(sellerId)
  if (firestoreProfile) {
    const normalizedFirestoreProfile = normalizeUserProfile(firestoreProfile, {
      displayName: firestoreProfile.fullName || 'Vendedor',
      email: firestoreProfile.email || '',
      photoURL: firestoreProfile.photoURL || '',
    })

    return toSellerSummary(sellerId, normalizedFirestoreProfile)
  }

  return (await getSellerPreviewById(sellerId)) || null
}

export async function getSellerProducts(sellerId, options = {}) {
  const {
    viewer = null,
    includeUnapproved = false,
    viewerAccess = null,
  } = options
  const resolvedViewerAccess = await resolveViewerAccess(viewer, viewerAccess)
  const sellerProducts = (await getAllProductsFirestore()).filter((item) => item.sellerId === sellerId)

  return sortProducts(
    filterProductsByVisibility(sellerProducts, viewer, resolvedViewerAccess, {
      includeUnapproved,
      allowOwnerAccess: false,
      allowAdminAccess: false,
    }),
    'recent',
  )
}

export async function createProduct(payload, user) {
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const access = await resolveUserAccess(user, { force: true })

  if (access.isBlacklisted) {
    throw new Error('Sua conta está bloqueada e não pode publicar anúncios.')
  }

  const isAdminActor = access.isAdmin
  const moderationStatus = isAdminActor ? 'approved' : 'pending'

  const sellerIdentity = getPreferredUserIdentity(user)
  const sellerPhotoForDocuments = isDataUrlPhoto(sellerIdentity.photoURL)
    ? ''
    : sellerIdentity.photoURL
  const hasFiles = Array.isArray(payload.photoFiles) && payload.photoFiles.length > 0
  let shouldPersistInFirestore = Boolean(isFirebaseConfigured && db)
  let photos = normalizePhotoList(payload.photos)
  const validPrice = validateProductPrice(payload.price)

  if (shouldPersistInFirestore && hasFiles) {
    try {
      photos = await uploadPhotosToStorage(payload.photoFiles, user)
    } catch (err) {
      const fallbackLocalPhotos = normalizePhotoList(payload.photos)
      const canPersistLocally = isStorageInfraError(err) && fallbackLocalPhotos.length > 0

      if (!canPersistLocally) {
        throw err
      }

      photos = fallbackLocalPhotos
      shouldPersistInFirestore = false
      console.warn(
        'Falha no upload para Storage. Produto será salvo localmente para evitar bloqueio no cadastro.',
        err,
      )
    }
  }

  if (shouldPersistInFirestore && photos.some((photo) => String(photo).startsWith('data:'))) {
    throw new Error(
      'Falha ao salvar fotos no Storage. Não é permitido salvar imagens em base64 no Firestore devido ao limite de tamanho.',
    )
  }

  validatePhotoCount(photos)

  if (shouldPersistInFirestore) {
    const documentPayload = normalizeProduct({
      id: undefined,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      price: validPrice,
      photos,
      condition: payload.condition || 'usado',
      deliveryOptions: payload.deliveryOptions,
      retrievalLocation: payload.retrievalLocation,
      sellerId: user.uid,
      sellerName: sellerIdentity.displayName,
      sellerPhotoURL: sellerPhotoForDocuments,
      createdAt: new Date().toISOString().slice(0, 10),
      moderationStatus,
      moderationReason: '',
      moderationUpdatedAt: new Date().toISOString(),
      moderationUpdatedByUid: isAdminActor ? user.uid : '',
      moderationUpdatedByEmail: isAdminActor ? user.email : '',
      reportReason: '',
      reportedAt: '',
      reportedByUid: '',
      reportedByEmail: '',
      isAdminPost: isAdminActor,
    })

    const created = await addDoc(collection(db, PRODUCTS_COLLECTION), {
      title: documentPayload.title,
      description: documentPayload.description,
      category: documentPayload.category,
      price: documentPayload.price,
      photos: documentPayload.photos,
      condition: documentPayload.condition,
      deliveryOptions: documentPayload.deliveryOptions,
      retrievalLocation: documentPayload.retrievalLocation,
      sellerId: documentPayload.sellerId,
      sellerName: documentPayload.sellerName,
      sellerPhotoURL: documentPayload.sellerPhotoURL,
      createdAt: documentPayload.createdAt,
      moderationStatus: documentPayload.moderationStatus,
      moderationReason: documentPayload.moderationReason,
      moderationUpdatedAt: documentPayload.moderationUpdatedAt,
      moderationUpdatedByUid: documentPayload.moderationUpdatedByUid,
      moderationUpdatedByEmail: documentPayload.moderationUpdatedByEmail,
      reportReason: documentPayload.reportReason,
      reportedAt: documentPayload.reportedAt,
      reportedByUid: documentPayload.reportedByUid,
      reportedByEmail: documentPayload.reportedByEmail,
      isAdminPost: documentPayload.isAdminPost,
    })

    return {
      ...documentPayload,
      id: created.id,
      storageMode: 'remote',
    }
  }

  const extra = safeRead(EXTRA_PRODUCTS_KEY, [])

  const newProduct = normalizeProduct({
    id: `product-${Date.now()}`,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    price: validPrice,
    photos,
    condition: payload.condition || 'usado',
    deliveryOptions: payload.deliveryOptions,
    retrievalLocation: payload.retrievalLocation,
    sellerId: user.uid,
    sellerName: sellerIdentity.displayName,
    sellerPhotoURL: sellerIdentity.photoURL,
    createdAt: new Date().toISOString().slice(0, 10),
    moderationStatus,
    moderationReason: '',
    moderationUpdatedAt: new Date().toISOString(),
    moderationUpdatedByUid: isAdminActor ? user.uid : '',
    moderationUpdatedByEmail: isAdminActor ? user.email : '',
    reportReason: '',
    reportedAt: '',
    reportedByUid: '',
    reportedByEmail: '',
    isAdminPost: isAdminActor,
  })

  extra.unshift(newProduct)
  safeWrite(EXTRA_PRODUCTS_KEY, extra)

  return {
    ...newProduct,
    storageMode: isFirebaseConfigured && db ? 'local-fallback' : 'local',
  }
}

export async function updateProduct(productId, payload, user) {
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const access = await resolveUserAccess(user, { force: true })

  if (access.isBlacklisted) {
    throw new Error('Sua conta está bloqueada e não pode editar anúncios.')
  }

  const isAdminActor = access.isAdmin

  const sellerIdentity = getPreferredUserIdentity(user)
  const sellerPhotoForDocuments = isDataUrlPhoto(sellerIdentity.photoURL)
    ? ''
    : sellerIdentity.photoURL
  const hasFiles = Array.isArray(payload.photoFiles) && payload.photoFiles.length > 0
  let nextPhotos = normalizePhotoList(payload.photos)
  
  const validPrice = validateProductPrice(payload.price)

  if (isFirebaseConfigured && db) {
    const reference = doc(db, PRODUCTS_COLLECTION, String(productId))
    const currentSnapshot = await getDoc(reference)

    if (!currentSnapshot.exists()) {
      throw new Error('Anúncio não encontrado.')
    }

    const current = normalizeProduct({
      id: currentSnapshot.id,
      ...currentSnapshot.data(),
    })

    const isOwner = current.sellerId === user.uid

    if (!isOwner && !isAdminActor) {
      throw new Error('Você não tem permissão para editar este anúncio.')
    }

    const keptPhotos = normalizePhotoList(payload.photos).filter((photo) => !isDataUrlPhoto(photo))
    const inlinePhotos = normalizePhotoList(payload.photos).filter((photo) => isDataUrlPhoto(photo))
    const currentStoredPhotos = normalizePhotoList(current.photos).filter((photo) => !isDataUrlPhoto(photo))

    if (!hasFiles && inlinePhotos.length) {
      throw new Error(
        'Falha ao salvar fotos no Storage. Não é permitido salvar imagens em base64 no Firestore devido ao limite de tamanho.',
      )
    }

    let uploadedPhotos = []

    if (hasFiles) {
      uploadedPhotos = await uploadPhotosToStorage(payload.photoFiles, user)
    }

    nextPhotos = normalizePhotoList([...keptPhotos, ...uploadedPhotos])

    validatePhotoCount(nextPhotos)

    const nextModerationStatus = isAdminActor
      ? normalizeModerationStatus(payload.moderationStatus || 'approved')
      : 'pending'
    const nextModerationReason =
      nextModerationStatus === 'rejected'
        ? String(payload.moderationReason || current.moderationReason || '').trim()
        : ''
    const shouldKeepReport = nextModerationStatus === 'reported'

    const removedPhotos = currentStoredPhotos.filter((photoUrl) => !keptPhotos.includes(photoUrl))

    const updated = normalizeProduct({
      ...current,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      price: validPrice,
      photos: nextPhotos,
      condition: payload.condition || current.condition,
      deliveryOptions: payload.deliveryOptions,
      retrievalLocation: payload.retrievalLocation,
      sellerName: sellerIdentity.displayName || current.sellerName,
      sellerPhotoURL: sellerPhotoForDocuments || current.sellerPhotoURL,
      moderationStatus: nextModerationStatus,
      moderationReason: nextModerationReason,
      moderationUpdatedAt: new Date().toISOString(),
      moderationUpdatedByUid: isAdminActor ? user.uid : '',
      moderationUpdatedByEmail: isAdminActor ? user.email : '',
      reportReason: shouldKeepReport ? current.reportReason : '',
      reportedAt: shouldKeepReport ? current.reportedAt : '',
      reportedByUid: shouldKeepReport ? current.reportedByUid : '',
      reportedByEmail: shouldKeepReport ? current.reportedByEmail : '',
      isAdminPost: current.isAdminPost || (isAdminActor && isOwner),
    })

    await updateDoc(reference, {
      title: updated.title,
      description: updated.description,
      category: updated.category,
      price: updated.price,
      photos: updated.photos,
      condition: updated.condition,
      deliveryOptions: updated.deliveryOptions,
      retrievalLocation: updated.retrievalLocation,
      sellerName: updated.sellerName,
      sellerPhotoURL: updated.sellerPhotoURL,
      moderationStatus: updated.moderationStatus,
      moderationReason: updated.moderationReason,
      moderationUpdatedAt: updated.moderationUpdatedAt,
      moderationUpdatedByUid: updated.moderationUpdatedByUid,
      moderationUpdatedByEmail: updated.moderationUpdatedByEmail,
      reportReason: updated.reportReason,
      reportedAt: updated.reportedAt,
      reportedByUid: updated.reportedByUid,
      reportedByEmail: updated.reportedByEmail,
      isAdminPost: updated.isAdminPost,
    })

    await deletePhotosFromStorage(removedPhotos)

    // Invalidar cache do produto atualizado
    invalidateProductCache(productId)

    return updated
  }

  const extra = safeRead(EXTRA_PRODUCTS_KEY, [])
  const index = extra.findIndex((item) => item.id === productId)

  if (index < 0) {
    throw new Error('Somente anúncios criados por você podem ser editados.')
  }

  const current = normalizeProduct(extra[index])

  const isOwner = current.sellerId === user.uid

  if (!isOwner && !isAdminActor) {
    throw new Error('Você não tem permissão para editar este anúncio.')
  }

  if (hasFiles) {
     const fallbackPhotos = normalizePhotoList([...nextPhotos, ...payload.photos.filter(p => String(p).startsWith('data:'))])
     if (fallbackPhotos.length > 0) {
        nextPhotos = fallbackPhotos
     }
  }

  validatePhotoCount(nextPhotos)

  const nextModerationStatus = isAdminActor
    ? normalizeModerationStatus(payload.moderationStatus || 'approved')
    : 'pending'
  const nextModerationReason =
    nextModerationStatus === 'rejected'
      ? String(payload.moderationReason || current.moderationReason || '').trim()
      : ''
  const shouldKeepReport = nextModerationStatus === 'reported'

  const updated = normalizeProduct({
    ...current,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    price: validPrice,
    photos: nextPhotos,
    condition: payload.condition || current.condition,
    deliveryOptions: payload.deliveryOptions,
    retrievalLocation: payload.retrievalLocation,
    sellerName: sellerIdentity.displayName || current.sellerName,
    sellerPhotoURL: sellerIdentity.photoURL || current.sellerPhotoURL,
    moderationStatus: nextModerationStatus,
    moderationReason: nextModerationReason,
    moderationUpdatedAt: new Date().toISOString(),
    moderationUpdatedByUid: isAdminActor ? user.uid : '',
    moderationUpdatedByEmail: isAdminActor ? user.email : '',
    reportReason: shouldKeepReport ? current.reportReason : '',
    reportedAt: shouldKeepReport ? current.reportedAt : '',
    reportedByUid: shouldKeepReport ? current.reportedByUid : '',
    reportedByEmail: shouldKeepReport ? current.reportedByEmail : '',
    isAdminPost: current.isAdminPost || (isAdminActor && isOwner),
  })

  extra[index] = updated
  safeWrite(EXTRA_PRODUCTS_KEY, extra)

  return updated
}

export async function deleteProduct(productId, user) {
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const access = await resolveUserAccess(user, { force: true })

  if (access.isBlacklisted) {
    throw new Error('Sua conta está bloqueada e não pode excluir anúncios.')
  }

  const isAdminActor = access.isAdmin

  if (isFirebaseConfigured && db) {
    const reference = doc(db, PRODUCTS_COLLECTION, String(productId))
    const currentSnapshot = await getDoc(reference)

    if (!currentSnapshot.exists()) {
      throw new Error('Anúncio não encontrado.')
    }

    const current = normalizeProduct({
      id: currentSnapshot.id,
      ...currentSnapshot.data(),
    })

    if (current.sellerId !== user.uid && !isAdminActor) {
      throw new Error('Você não tem permissão para excluir este anúncio.')
    }

    const storagePhotos = normalizePhotoList(current.photos).filter((photo) => !isDataUrlPhoto(photo))

    await deleteDoc(reference)
    await deletePhotosFromStorage(storagePhotos)
    removeProductFromAllFavorites(String(productId))

    // Invalidar cache do produto deletado
    invalidateProductCache(productId)

    return
  }

  const extra = safeRead(EXTRA_PRODUCTS_KEY, [])
  const index = extra.findIndex((item) => item.id === productId)

  if (index < 0) {
    throw new Error('Somente anúncios criados por você podem ser excluídos.')
  }

  const current = normalizeProduct(extra[index])

  if (current.sellerId !== user.uid && !isAdminActor) {
    throw new Error('Você não tem permissão para excluir este anúncio.')
  }

  extra.splice(index, 1)
  safeWrite(EXTRA_PRODUCTS_KEY, extra)
  removeProductFromAllFavorites(productId)
}

export async function getMyProfile(user) {
  if (!user) {
    return null
  }

  const localProfile = getStoredUserProfile(user.uid)

  if (localProfile) {
    return toMyProfileData(user, normalizeUserProfile(localProfile, user))
  }

  // Tentar buscar do Firestore primeiro
  const firestoreProfile = await getUserProfileFromFirestore(user.uid)
  if (firestoreProfile) {
    const normalizedProfile = normalizeUserProfile(firestoreProfile, user)
    cacheNormalizedUserProfile(user.uid, normalizedProfile)

    return toMyProfileData(user, normalizedProfile)
  }

  // Fallback para dados locais/seed
  return seedSellers[user.uid] || sellerFromUser(user)
}

export async function getMyProducts(user) {
  if (!user) {
    return []
  }

  return sortProducts(
    (await getAllProductsFirestore()).filter((item) => item.sellerId === user.uid),
    'recent',
  )
}

export async function deleteUserMarketplaceData(user) {
  if (!user?.uid) {
    throw new Error('Usuário não autenticado')
  }

  const myProducts = await getMyProducts(user)

  for (const product of myProducts) {
    await deleteProduct(product.id, user)
  }

  removeLocalProductsBySeller(user.uid)

  const profiles = readUserProfiles()
  const currentProfile = profiles[user.uid] || null

  if (Object.prototype.hasOwnProperty.call(profiles, user.uid)) {
    delete profiles[user.uid]
    saveUserProfiles(profiles)
  }

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, USER_PROFILES_COLLECTION, user.uid))
    } catch (err) {
      console.warn('Falha ao remover perfil do Firestore:', err)
    }
  }

  const profilePhoto = String(currentProfile?.photoURL || '').trim()

  if (profilePhoto) {
    await deletePhotoFromStorage(profilePhoto)
  }

  clearFavoritesForUser(user.uid)
}

export async function getFavoriteProducts(user) {
  if (!user) {
    return []
  }

  const favoriteIds = safeRead(buildFavoriteKey(user.uid), [])
  const access = await resolveViewerAccess(user)
  const favoriteProducts = (await getAllProductsFirestore()).filter((item) => favoriteIds.includes(item.id))

  return sortProducts(
    filterProductsByVisibility(favoriteProducts, user, access, {
      includeUnapproved: false,
      allowOwnerAccess: false,
      allowAdminAccess: false,
    }),
    'recent',
  )
}

export async function isFavorite(user, productId) {
  if (!user) {
    return false
  }

  const favoriteIds = safeRead(buildFavoriteKey(user.uid), [])
  return favoriteIds.includes(productId)
}

export async function toggleFavorite(user, productId) {
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const key = buildFavoriteKey(user.uid)
  const favoriteIds = safeRead(key, [])
  const exists = favoriteIds.includes(productId)

  const next = exists
    ? favoriteIds.filter((id) => id !== productId)
    : [...favoriteIds, productId]

  safeWrite(key, next)
  return !exists
}

function toModerationFields(product, options = {}) {
  const includeIsAdminPost = options.includeIsAdminPost !== false

  const payload = {
    moderationStatus: product.moderationStatus,
    moderationReason: product.moderationReason,
    moderationUpdatedAt: product.moderationUpdatedAt,
    moderationUpdatedByUid: product.moderationUpdatedByUid,
    moderationUpdatedByEmail: product.moderationUpdatedByEmail,
    reportReason: product.reportReason,
    reportedAt: product.reportedAt,
    reportedByUid: product.reportedByUid,
    reportedByEmail: product.reportedByEmail,
  }

  if (includeIsAdminPost) {
    payload.isAdminPost = product.isAdminPost
  }

  return payload
}

async function applyModerationUpdate(productId, updater, options = {}) {
  if (isFirebaseConfigured && db) {
    const reference = doc(db, PRODUCTS_COLLECTION, String(productId))
    const snapshot = await getDoc(reference)

    if (!snapshot.exists()) {
      throw new Error('Anúncio não encontrado.')
    }

    const current = normalizeProduct({ id: snapshot.id, ...snapshot.data() })
    const updated = normalizeProduct(updater(current))

    await updateDoc(reference, toModerationFields(updated, options))
    setCachedProduct(productId, updated)
    return updated
  }

  const extra = safeRead(EXTRA_PRODUCTS_KEY, [])
  const index = extra.findIndex((item) => String(item.id || '') === String(productId || ''))

  if (index < 0) {
    throw new Error('Anúncio não encontrado.')
  }

  const current = normalizeProduct(extra[index])
  const updated = normalizeProduct(updater(current))

  extra[index] = updated
  safeWrite(EXTRA_PRODUCTS_KEY, extra)
  setCachedProduct(productId, updated)

  return updated
}

function mergeEntriesById(entries) {
  const merged = new Map()

  entries.forEach((entry) => {
    const normalized = normalizeBlacklistEntry(entry)

    if (!normalized) {
      return
    }

    merged.set(normalized.id, normalized)
  })

  return Array.from(merged.values())
}

async function readFirestoreBlacklistEntries() {
  if (!isFirebaseConfigured || !db) {
    return []
  }

  try {
    const snapshot = await getDocs(collection(db, BLACKLIST_COLLECTION))

    return snapshot.docs
      .map((item) => normalizeBlacklistEntry({ id: item.id, ...item.data() }))
      .filter(Boolean)
  } catch {
    return []
  }
}

async function getAllBlacklistEntries() {
  return mergeEntriesById([...readLocalBlacklist(), ...(await readFirestoreBlacklistEntries())])
}

async function getAdminEmailsFromFirestore() {
  if (!isFirebaseConfigured || !db) {
    return []
  }

  try {
    const snapshot = await getDocs(collection(db, ADMIN_USERS_COLLECTION))
    const emails = snapshot.docs
      .map((item) => item.data())
      .filter((item) => item?.active !== false)
      .map((item) => normalizeEmail(item.emailLowercase || item.email || item.adminEmail))
      .filter((email) => isAdminDomainEmail(email))

    if (emails.length) {
      safeWrite(ADMIN_USERS_KEY, emails)
    }

    return Array.from(new Set(emails))
  } catch {
    return []
  }
}

function toHomeMessageDocument(payload) {
  return {
    title: payload.title,
    message: payload.message,
    enabled: payload.enabled,
    updatedAt: payload.updatedAt,
    updatedByUid: payload.updatedByUid,
    updatedByEmail: payload.updatedByEmail,
  }
}

export async function getHomeMessage() {
  if (isFirebaseConfigured && db) {
    try {
      const snapshot = await getDoc(doc(db, HOME_MESSAGES_COLLECTION, HOME_MESSAGE_DOC_ID))

      if (snapshot.exists()) {
        const normalized = normalizeHomeMessagePayload(snapshot.data())
        safeWrite(HOME_MESSAGE_KEY, normalized)
        return normalized.enabled ? normalized : null
      }
    } catch {
      // No-op: fallback below.
    }
  }

  const localStored = safeRead(HOME_MESSAGE_KEY, null)

  if (localStored && typeof localStored === 'object') {
    const normalized = normalizeHomeMessagePayload(localStored)

    if (normalized.enabled) {
      return normalized
    }

    return null
  }

}

export async function saveHomeMessageByAdmin(adminUser, payload = {}) {
  await assertAdminUser(adminUser)

  const normalized = normalizeHomeMessagePayload({
    ...payload,
    updatedByUid: adminUser?.uid,
    updatedByEmail: adminUser?.email,
  })

  safeWrite(HOME_MESSAGE_KEY, normalized)

  if (isFirebaseConfigured && db) {
    await setDoc(
      doc(db, HOME_MESSAGES_COLLECTION, HOME_MESSAGE_DOC_ID),
      toHomeMessageDocument(normalized),
    )
  }

  return normalized.enabled ? normalized : null
}

export async function clearHomeMessageByAdmin(adminUser) {
  return saveHomeMessageByAdmin(adminUser, {
    title: '',
    message: '',
    enabled: false,
  })
}

export async function reportProduct(productId, reporterUser, reason = '') {
  if (!reporterUser) {
    throw new Error('Usuário não autenticado')
  }

  const reporterAccess = await resolveUserAccess(reporterUser, { force: true })

  if (reporterAccess.isBlacklisted) {
    throw new Error('Sua conta está bloqueada e não pode reportar anúncios.')
  }

  const current = await getProductById(productId, {
    viewer: reporterUser,
    viewerAccess: reporterAccess,
    includeUnapproved: true,
  })

  if (!current) {
    throw new Error('Anúncio não encontrado.')
  }

  if (current.sellerId === reporterUser.uid) {
    throw new Error('Você não pode reportar seu próprio anúncio.')
  }

  const reportReason = String(reason || '').trim().slice(0, 400)

  return applyModerationUpdate(
    productId,
    (existing) => ({
      ...existing,
      moderationStatus: 'reported',
      moderationReason: '',
      moderationUpdatedAt: new Date().toISOString(),
      moderationUpdatedByUid: '',
      moderationUpdatedByEmail: '',
      reportReason: reportReason || 'Sem descrição adicional.',
      reportedAt: new Date().toISOString(),
      reportedByUid: reporterUser.uid,
      reportedByEmail: reporterUser.email,
    }),
    { includeIsAdminPost: false },
  )
}

export async function approveProductByAdmin(productId, adminUser) {
  await assertAdminUser(adminUser)

  return applyModerationUpdate(productId, (existing) => ({
    ...existing,
    moderationStatus: 'approved',
    moderationReason: '',
    moderationUpdatedAt: new Date().toISOString(),
    moderationUpdatedByUid: adminUser.uid,
    moderationUpdatedByEmail: adminUser.email,
    reportReason: '',
    reportedAt: '',
    reportedByUid: '',
    reportedByEmail: '',
  }))
}

export async function rejectProductByAdmin(productId, adminUser, reason = '') {
  await assertAdminUser(adminUser)

  return applyModerationUpdate(productId, (existing) => ({
    ...existing,
    moderationStatus: 'rejected',
    moderationReason: String(reason || '').trim().slice(0, 400),
    moderationUpdatedAt: new Date().toISOString(),
    moderationUpdatedByUid: adminUser.uid,
    moderationUpdatedByEmail: adminUser.email,
    reportReason: '',
    reportedAt: '',
    reportedByUid: '',
    reportedByEmail: '',
  }))
}

export async function getProductsForModeration(adminUser, options = {}) {
  await assertAdminUser(adminUser)

  const statusFilter = String(options.status || '').trim().toLowerCase()
  const allProducts = await getAllProductsFirestore()

  if (!statusFilter) {
    return sortProducts(allProducts, 'recent')
  }

  return sortProducts(
    allProducts.filter((product) => normalizeModerationStatus(product.moderationStatus) === statusFilter),
    'recent',
  )
}

export async function getPendingProductsForAdmin(adminUser) {
  return getProductsForModeration(adminUser, { status: 'pending' })
}

export async function getReportedProductsForAdmin(adminUser) {
  return getProductsForModeration(adminUser, { status: 'reported' })
}

export async function getBlacklistedUsers(adminUser) {
  await assertAdminUser(adminUser)

  return (await getAllBlacklistEntries())
    .filter((entry) => entry.active)
    .sort((a, b) => new Date(b.bannedAt).getTime() - new Date(a.bannedAt).getTime())
}

async function setSellerProductsModerationByAdmin(sellerId, adminUser, moderationStatus, moderationReason = '') {
  const safeSellerId = String(sellerId || '').trim()

  if (!safeSellerId) {
    return
  }

  const nextStatus = normalizeModerationStatus(moderationStatus)
  const nowIso = new Date().toISOString()

  if (isFirebaseConfigured && db) {
    try {
      const snapshot = await getDocs(
        query(collection(db, PRODUCTS_COLLECTION), where('sellerId', '==', safeSellerId)),
      )

      if (!snapshot.empty) {
        await Promise.all(
          snapshot.docs.map(async (item) => {
            await updateDoc(item.ref, {
              moderationStatus: nextStatus,
              moderationReason: moderationReason,
              moderationUpdatedAt: nowIso,
              moderationUpdatedByUid: adminUser.uid,
              moderationUpdatedByEmail: adminUser.email,
              reportReason: '',
              reportedAt: '',
              reportedByUid: '',
              reportedByEmail: '',
            })

            invalidateProductCache(item.id)
          }),
        )
      }
    } catch {
      // No-op: local fallback below still applies when available.
    }
  }

  const extra = safeRead(EXTRA_PRODUCTS_KEY, [])
  let changedLocal = false

  const nextExtra = extra.map((item) => {
    const normalized = normalizeProduct(item)

    if (normalized.sellerId !== safeSellerId) {
      return item
    }

    changedLocal = true

    return {
      ...normalized,
      moderationStatus: nextStatus,
      moderationReason: moderationReason,
      moderationUpdatedAt: nowIso,
      moderationUpdatedByUid: adminUser.uid,
      moderationUpdatedByEmail: adminUser.email,
      reportReason: '',
      reportedAt: '',
      reportedByUid: '',
      reportedByEmail: '',
    }
  })

  if (changedLocal) {
    safeWrite(EXTRA_PRODUCTS_KEY, nextExtra)
  }
}

export async function banUserByAdmin(adminUser, targetUser, reason = '') {
  await assertAdminUser(adminUser)

  const targetUid = String(targetUser?.uid || '').trim()
  const targetEmail = normalizeEmail(targetUser?.email)

  if (!targetUid && !targetEmail) {
    throw new Error('Informe ao menos UID ou email para banir o usuário.')
  }

  if (targetUid && targetUid === adminUser.uid) {
    throw new Error('Não é permitido banir a própria conta administradora.')
  }

  const targetAccess = await resolveUserAccess(
    {
      uid: targetUid,
      email: targetEmail,
    },
    { force: true },
  )

  if (targetAccess.isAdmin) {
    throw new Error('Não é permitido banir outro administrador.')
  }

  const entry = normalizeBlacklistEntry({
    id: targetUid || targetEmail,
    uid: targetUid,
    email: targetEmail,
    reason: String(reason || '').trim().slice(0, 400),
    active: true,
    bannedAt: new Date().toISOString(),
    bannedByUid: adminUser.uid,
    bannedByEmail: adminUser.email,
  })

  const localEntries = mergeEntriesById([...readLocalBlacklist(), entry]).map((item) =>
    item.id === entry.id ? entry : item,
  )

  saveLocalBlacklist(localEntries)

  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, BLACKLIST_COLLECTION, entry.id), {
      ...entry,
      emailLowercase: entry.email,
    })
  }

  const banReason = entry.reason || 'Conta suspensa pela administração.'

  if (targetUid) {
    await setSellerProductsModerationByAdmin(targetUid, adminUser, 'rejected', banReason)
  }

  clearCachedAccess({ uid: targetUid, email: targetEmail })

  return entry
}

export async function unbanUserByAdmin(adminUser, targetUser = {}) {
  await assertAdminUser(adminUser)

  const targetId = String(targetUser.id || '').trim()
  const targetUid = String(targetUser.uid || '').trim()
  const targetEmail = normalizeEmail(targetUser.email)

  const localEntries = readLocalBlacklist()
  const nextLocalEntries = localEntries.filter((entry) => {
    const normalized = normalizeBlacklistEntry(entry)

    if (!normalized) {
      return false
    }

    if (targetId && normalized.id === targetId) {
      return false
    }

    if (targetUid && normalized.uid === targetUid) {
      return false
    }

    if (targetEmail && normalized.email === targetEmail) {
      return false
    }

    return true
  })

  saveLocalBlacklist(nextLocalEntries)

  if (isFirebaseConfigured && db) {
    const idsToDelete = new Set()

    if (targetId) {
      idsToDelete.add(targetId)
    }

    if (targetUid) {
      idsToDelete.add(targetUid)
    }

    if (targetEmail) {
      idsToDelete.add(targetEmail)
    }

    for (const id of idsToDelete) {
      try {
        await deleteDoc(doc(db, BLACKLIST_COLLECTION, id))
      } catch {
        // No-op: fallback queries below handle alternate documents.
      }
    }

    if (targetUid) {
      try {
        const byUid = await getDocs(
          query(collection(db, BLACKLIST_COLLECTION), where('uid', '==', targetUid)),
        )
        await Promise.all(byUid.docs.map((item) => deleteDoc(item.ref)))
      } catch {
        // No-op.
      }
    }

    if (targetEmail) {
      try {
        const byEmailLowercase = await getDocs(
          query(collection(db, BLACKLIST_COLLECTION), where('emailLowercase', '==', targetEmail)),
        )
        await Promise.all(byEmailLowercase.docs.map((item) => deleteDoc(item.ref)))
      } catch {
        // No-op.
      }

      try {
        const byEmail = await getDocs(
          query(collection(db, BLACKLIST_COLLECTION), where('email', '==', targetEmail)),
        )
        await Promise.all(byEmail.docs.map((item) => deleteDoc(item.ref)))
      } catch {
        // No-op.
      }
    }
  }

  if (targetUid) {
    await setSellerProductsModerationByAdmin(
      targetUid,
      adminUser,
      'pending',
      'Conta reativada. Aguarda nova aprovação da administração.',
    )
  }

  clearCachedAccess({ uid: targetUid, email: targetEmail })
}

export async function getUsersForAdmin(adminUser) {
  await assertAdminUser(adminUser)

  const usersByUid = new Map()
  const profiles = readUserProfiles()

  Object.entries(profiles).forEach(([uid, rawProfile]) => {
    const normalizedProfile = normalizeUserProfile(rawProfile, {
      uid,
      displayName: rawProfile?.fullName || 'Usuário',
      email: rawProfile?.email || '',
      photoURL: rawProfile?.photoURL || '',
    })

    usersByUid.set(uid, {
      uid,
      email: normalizeEmail(normalizedProfile.email),
      name: normalizedProfile.fullName || 'Usuário',
      photoURL: normalizedProfile.photoURL || '',
      city: normalizedProfile.hometown || 'Não informado',
      createdAt: normalizedProfile.createdAt || '',
    })
  })

  if (isFirebaseConfigured && db) {
    try {
      const firestoreProfiles = await getDocs(collection(db, USER_PROFILES_COLLECTION))

      firestoreProfiles.docs.forEach((item) => {
        const profile = item.data()
        const uid = item.id
        const previous = usersByUid.get(uid) || {}

        usersByUid.set(uid, {
          uid,
          email: normalizeEmail(profile.email || previous.email),
          name: String(profile.fullName || previous.name || 'Usuário').trim(),
          photoURL: String(profile.photoURL || previous.photoURL || '').trim(),
          city: String(profile.hometown || previous.city || 'Não informado').trim(),
          createdAt: String(profile.createdAt || previous.createdAt || ''),
        })
      })
    } catch {
      // No-op: local profiles are still available.
    }
  }

  const allProducts = await getAllProductsFirestore()
  const productCountBySeller = new Map()

  allProducts.forEach((product) => {
    const sellerId = String(product.sellerId || '').trim()

    if (!sellerId) {
      return
    }

    productCountBySeller.set(sellerId, Number(productCountBySeller.get(sellerId) || 0) + 1)

    if (!usersByUid.has(sellerId)) {
      usersByUid.set(sellerId, {
        uid: sellerId,
        email: '',
        name: String(product.sellerName || 'Usuário').trim() || 'Usuário',
        photoURL: String(product.sellerPhotoURL || '').trim(),
        city: 'Não informado',
        createdAt: String(product.createdAt || ''),
      })
    }
  })

  const blacklistEntries = await getAllBlacklistEntries()
  const blacklistedByUid = new Map()
  const blacklistedByEmail = new Map()

  blacklistEntries.forEach((entry) => {
    if (!entry.active) {
      return
    }

    if (entry.uid) {
      blacklistedByUid.set(entry.uid, entry)
    }

    if (entry.email) {
      blacklistedByEmail.set(entry.email, entry)
    }
  })

  const adminEmails = new Set([...readLocalAdminEmails(), ...(await getAdminEmailsFromFirestore())])

  return Array.from(usersByUid.values())
    .map((item) => {
      const bannedEntry =
        blacklistedByUid.get(item.uid) || (item.email ? blacklistedByEmail.get(item.email) : null)

      return {
        ...item,
        productCount: Number(productCountBySeller.get(item.uid) || 0),
        isAdmin: item.email ? adminEmails.has(item.email) : false,
        isBlacklisted: Boolean(bannedEntry),
        blacklistReason: bannedEntry?.reason || '',
        blacklistId: bannedEntry?.id || '',
        bannedAt: bannedEntry?.bannedAt || '',
      }
    })
    .sort((a, b) => {
      if (a.isBlacklisted !== b.isBlacklisted) {
        return a.isBlacklisted ? -1 : 1
      }

      return a.name.localeCompare(b.name)
    })
}

export async function deleteUserDataByAdmin(adminUser, targetUser) {
  await assertAdminUser(adminUser)

  const targetUid = String(targetUser?.uid || '').trim()
  const targetEmail = normalizeEmail(targetUser?.email)

  if (!targetUid) {
    throw new Error('UID do usuário alvo é obrigatório para exclusão.')
  }

  if (targetUid === adminUser.uid) {
    throw new Error('Não é permitido excluir os dados da própria conta administradora.')
  }

  const targetAccess = await resolveUserAccess(
    {
      uid: targetUid,
      email: targetEmail,
    },
    { force: true },
  )

  if (targetAccess.isAdmin) {
    throw new Error('Não é permitido excluir dados de outro administrador.')
  }

  const userProducts = (await getAllProductsFirestore()).filter((item) => item.sellerId === targetUid)

  for (const product of userProducts) {
    await deleteProduct(product.id, adminUser)
  }

  removeLocalProductsBySeller(targetUid)

  const profiles = readUserProfiles()
  const targetProfile = profiles[targetUid] || null

  if (Object.prototype.hasOwnProperty.call(profiles, targetUid)) {
    delete profiles[targetUid]
    saveUserProfiles(profiles)
  }

  if (isFirebaseConfigured && db) {
    try {
      await deleteDoc(doc(db, USER_PROFILES_COLLECTION, targetUid))
    } catch {
      // No-op: local cleanup already happened.
    }
  }

  const profilePhoto = String(targetProfile?.photoURL || '').trim()

  if (profilePhoto) {
    await deletePhotoFromStorage(profilePhoto)
  }

  clearFavoritesForUser(targetUid)
  clearCachedAccess({ uid: targetUid, email: targetEmail })

  return {
    deletedProducts: userProducts.length,
    deletedProfile: Boolean(targetProfile),
  }
}

export function clearUserAccessCache() {
  clearCachedAccess()
}

export function clearProductCache() {
  productCache.clear()
}

export function clearCachedProduct(productId) {
  invalidateProductCache(productId)
}
