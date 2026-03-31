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
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import {
  app,
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
const MIN_PRODUCT_PHOTOS = 1
const MAX_PRODUCT_PHOTOS = 5
const MAX_PRODUCT_PRICE = 9999.99
const PRODUCT_CACHE_TTL = 5 * 60 * 1000 // 5 minutos

// Cache em memória para produtos
const productCache = new Map()

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

function normalizeProduct(product) {
  return {
    ...product,
    id: product.id,
    title: product.title || 'Sem titulo',
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
  }
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
    throw new Error(`Envie no maximo ${MAX_PRODUCT_PHOTOS} fotos por produto.`)
  }
}

function validateProductPrice(price) {
  const numericPrice = Number(price)

  if (!Number.isFinite(numericPrice) || numericPrice < 0 || numericPrice > MAX_PRODUCT_PRICE) {
    throw new Error('O preco deve estar entre R$ 0,00 e R$ 9.999,99.')
  }

  return Number(numericPrice.toFixed(2))
}

async function uploadPhotosToStorage(files, user) {
  if (!storage) {
    throw new Error('Storage do Firebase nao esta configurado.')
  }

  const now = Date.now()
  const uploads = files.slice(0, MAX_PRODUCT_PHOTOS).map(async (file, index) => {
    const extension = String(file.name || 'jpg').split('.').pop() || 'jpg'
    const path = `products/${user.uid}/${now}-${index}.${extension}`

    const uploadWith = async (storageInstance) => {
      const storageRef = ref(storageInstance, path)
      await uploadBytes(storageRef, file)
      return getDownloadURL(storageRef)
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
        app

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
  } catch {
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
      // Melhor esforco: mantemos o anuncio consistente mesmo se cleanup falhar.
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
    return items.sort((a, b) => a.price - b.price)
  }

  if (sortBy === 'priceDesc') {
    return items.sort((a, b) => b.price - a.price)
  }

  return items.sort(compareByCreatedAtDesc)
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

async function getProductByIdFirestore(productId) {
  if (!isFirebaseConfigured || !db) {
    return getAllProducts().find((item) => item.id === productId) || null
  }

  // Verificar cache primeiro
  const cached = getCachedProduct(productId)
  if (cached) {
    return cached
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

  return product
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
    city: sellerProfile.hometown || 'Nao informado',
    joinedAt:
      sellerProfile.createdAt || sample.createdAt || new Date().toISOString().slice(0, 10),
    about: sellerProfile.aboutMe || 'Nao Disponivel',
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
      'Nao informado',
    joinedAt: String(profile?.createdAt || fallback.joinedAt || now),
    about: String(profile?.aboutMe || fallback.about || '').trim() || 'Nao Disponivel',
    universityRole: String(profile?.universityRole || '').trim(),
  }
}

function toMyProfileData(user, normalizedProfile) {
  const now = new Date().toISOString().slice(0, 10)

  return {
    id: user.uid,
    name: normalizedProfile?.fullName || user.displayName || 'Meu Perfil',
    photoURL: normalizedProfile?.photoURL || '',
    city: normalizedProfile?.hometown || 'Nao informado',
    joinedAt: normalizedProfile?.createdAt || now,
    about: normalizedProfile?.aboutMe || 'Nao Disponivel',
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
    throw new Error('Storage do Firebase nao esta configurado.')
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
      app

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
    throw new Error('Usuario nao autenticado')
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

export async function getAvailableCategories() {
  const categories = [...new Set((await getAllProductsFirestore()).map((item) => item.category))]
  return categories.sort((a, b) => a.localeCompare(b))
}

export async function searchProducts(filters = {}) {
  const {
    query = '',
    category = '',
    minPrice = '',
    maxPrice = '',
    condition = '',
    sortBy = 'recent',
  } = filters

  const min = minPrice === '' ? Number.NEGATIVE_INFINITY : Number(minPrice)
  const max = maxPrice === '' ? Number.POSITIVE_INFINITY : Number(maxPrice)
  const term = query.trim().toLowerCase()

  const filtered = (await getAllProductsFirestore()).filter((product) => {
    const matchName = term ? product.title.toLowerCase().includes(term) : true
    const matchCategory = category ? product.category === category : true
    const matchPrice = product.price >= min && product.price <= max
    const matchCondition = condition ? product.condition === condition : true

    return matchName && matchCategory && matchPrice && matchCondition
  })

  return sortProducts(filtered, sortBy)
}

export async function getFreeProducts(limit = 8) {
  return (await getAllProductsFirestore())
    .filter((item) => item.price === 0)
    .sort(compareByCreatedAtDesc)
    .slice(0, limit)
}

export async function getRecentProducts(limit = 8) {
  return (await getAllProductsFirestore()).sort(compareByCreatedAtDesc).slice(0, limit)
}

export async function getProductById(productId) {
  return getProductByIdFirestore(productId)
}

export async function getSellerById(sellerId) {
  const seeded = seedSellers[sellerId]

  if (seeded) {
    return {
      ...seeded,
      city: seeded.city || 'Nao informado',
      joinedAt: seeded.joinedAt || new Date().toISOString().slice(0, 10),
      about: seeded.about || 'Nao Disponivel',
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

export async function getSellerProducts(sellerId) {
  return (await getAllProductsFirestore()).filter((item) => item.sellerId === sellerId)
}

export async function createProduct(payload, user) {
  if (!user) {
    throw new Error('Usuario nao autenticado')
  }

  const sellerIdentity = getPreferredUserIdentity(user)
  const sellerPhotoForDocuments = isDataUrlPhoto(sellerIdentity.photoURL)
    ? ''
    : sellerIdentity.photoURL
  const hasFiles = Array.isArray(payload.photoFiles) && payload.photoFiles.length > 0
  let photos = normalizePhotoList(payload.photos)
  const validPrice = validateProductPrice(payload.price)

  if (isFirebaseConfigured && db && hasFiles) {
    photos = await uploadPhotosToStorage(payload.photoFiles, user)
  }

  if (isFirebaseConfigured && db && photos.some((photo) => String(photo).startsWith('data:'))) {
    throw new Error(
      'Falha ao salvar fotos no Storage. Nao e permitido salvar imagens em base64 no Firestore devido ao limite de tamanho.',
    )
  }

  validatePhotoCount(photos)

  if (isFirebaseConfigured && db) {
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
    })

    return {
      ...documentPayload,
      id: created.id,
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
  })

  extra.unshift(newProduct)
  safeWrite(EXTRA_PRODUCTS_KEY, extra)

  return newProduct
}

export async function updateProduct(productId, payload, user) {
  if (!user) {
    throw new Error('Usuario nao autenticado')
  }

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
      throw new Error('Anuncio nao encontrado.')
    }

    const current = normalizeProduct({
      id: currentSnapshot.id,
      ...currentSnapshot.data(),
    })

    if (current.sellerId !== user.uid) {
      throw new Error('Voce nao tem permissao para editar este anuncio.')
    }

    const keptPhotos = normalizePhotoList(payload.photos).filter((photo) => !isDataUrlPhoto(photo))
    const inlinePhotos = normalizePhotoList(payload.photos).filter((photo) => isDataUrlPhoto(photo))
    const currentStoredPhotos = normalizePhotoList(current.photos).filter((photo) => !isDataUrlPhoto(photo))

    if (!hasFiles && inlinePhotos.length) {
      throw new Error(
        'Falha ao salvar fotos no Storage. Nao e permitido salvar imagens em base64 no Firestore devido ao limite de tamanho.',
      )
    }

    let uploadedPhotos = []

    if (hasFiles) {
      uploadedPhotos = await uploadPhotosToStorage(payload.photoFiles, user)
    }

    nextPhotos = normalizePhotoList([...keptPhotos, ...uploadedPhotos])

    validatePhotoCount(nextPhotos)

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
    })

    await deletePhotosFromStorage(removedPhotos)

    // Invalidar cache do produto atualizado
    invalidateProductCache(productId)

    return updated
  }

  const extra = safeRead(EXTRA_PRODUCTS_KEY, [])
  const index = extra.findIndex((item) => item.id === productId)

  if (index < 0) {
    throw new Error('Somente anuncios criados por voce podem ser editados.')
  }

  const current = normalizeProduct(extra[index])

  if (current.sellerId !== user.uid) {
    throw new Error('Voce nao tem permissao para editar este anuncio.')
  }

  if (hasFiles) {
     const fallbackPhotos = normalizePhotoList([...nextPhotos, ...payload.photos.filter(p => String(p).startsWith('data:'))])
     if (fallbackPhotos.length > 0) {
        nextPhotos = fallbackPhotos
     }
  }

  validatePhotoCount(nextPhotos)

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
  })

  extra[index] = updated
  safeWrite(EXTRA_PRODUCTS_KEY, extra)

  return updated
}

export async function deleteProduct(productId, user) {
  if (!user) {
    throw new Error('Usuario nao autenticado')
  }

  if (isFirebaseConfigured && db) {
    const reference = doc(db, PRODUCTS_COLLECTION, String(productId))
    const currentSnapshot = await getDoc(reference)

    if (!currentSnapshot.exists()) {
      throw new Error('Anuncio nao encontrado.')
    }

    const current = normalizeProduct({
      id: currentSnapshot.id,
      ...currentSnapshot.data(),
    })

    if (current.sellerId !== user.uid) {
      throw new Error('Voce nao tem permissao para excluir este anuncio.')
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
    throw new Error('Somente anuncios criados por voce podem ser excluidos.')
  }

  const current = normalizeProduct(extra[index])

  if (current.sellerId !== user.uid) {
    throw new Error('Voce nao tem permissao para excluir este anuncio.')
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

  return (await getAllProductsFirestore()).filter((item) => item.sellerId === user.uid)
}

export async function deleteUserMarketplaceData(user) {
  if (!user?.uid) {
    throw new Error('Usuario nao autenticado')
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
  return (await getAllProductsFirestore()).filter((item) => favoriteIds.includes(item.id))
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
    throw new Error('Usuario nao autenticado')
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

export function clearProductCache() {
  productCache.clear()
}

export function clearCachedProduct(productId) {
  invalidateProductCache(productId)
}
