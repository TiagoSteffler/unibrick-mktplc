import { reactive } from 'vue'

const CACHE_PREFIX = 'unibrik_cache_'

// Estado reativo global em memória
export const cacheState = reactive({
  collections: {},
  docs: {}
})

// Utilitário para gerenciar cache no Session Storage e no State
export function getCachedCollection(collectionName) {
  if (cacheState.collections[collectionName]) {
    return cacheState.collections[collectionName]
  }

  try {
    const cached = sessionStorage.getItem(`${CACHE_PREFIX}${collectionName}`)
    if (cached) {
      const parsed = JSON.parse(cached)
      cacheState.collections[collectionName] = parsed
      return parsed
    }
  } catch {
    // Falha silenciosa
  }

  return null
}

export function setCachedCollection(collectionName, data) {
  cacheState.collections[collectionName] = data
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${collectionName}`, JSON.stringify(data))
  } catch {
    // Falha silenciosa se exceder o limite do storage
  }
}

export function getCachedDoc(collectionName, docId) {
  const key = `${collectionName}_${docId}`
  if (cacheState.docs[key]) {
    return cacheState.docs[key]
  }

  try {
    const cached = sessionStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (cached) {
      const parsed = JSON.parse(cached)
      cacheState.docs[key] = parsed
      return parsed
    }
  } catch {
    // Falha silenciosa
  }

  return null
}

export function setCachedDoc(collectionName, docId, data) {
  const key = `${collectionName}_${docId}`
  cacheState.docs[key] = data
  
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data))
  } catch {
    // Falha silenciosa
  }
}

export function invalidateCache(collectionName, docId = null) {
  if (docId) {
    const key = `${collectionName}_${docId}`
    delete cacheState.docs[key]
    sessionStorage.removeItem(`${CACHE_PREFIX}${key}`)
  } else {
    delete cacheState.collections[collectionName]
    sessionStorage.removeItem(`${CACHE_PREFIX}${collectionName}`)
    sessionStorage.removeItem(`${CACHE_PREFIX}${collectionName}_timestamp`)
  }
}

export function getCacheTimestamp(collectionName) {
  try {
    const cached = sessionStorage.getItem(`${CACHE_PREFIX}${collectionName}_timestamp`)
    return cached || null
  } catch {
    return null
  }
}

export function setCacheTimestamp(collectionName, timestamp) {
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${collectionName}_timestamp`, timestamp)
  } catch {
    // Falha silenciosa
  }
}
