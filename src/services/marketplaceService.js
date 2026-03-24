const EXTRA_PRODUCTS_KEY = 'marketplace_extra_products'

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

function normalizeProduct(product) {
  return {
    ...product,
    price: Number(product.price || 0),
    condition: product.condition || 'usado',
    photos: Array.isArray(product.photos) ? product.photos.filter(Boolean) : [],
  }
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

function buildFavoriteKey(userId) {
  return `marketplace_favorites_${userId}`
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

function sellerFromUser(user) {
  return {
    id: user.uid,
    name: user.displayName || 'Meu Perfil',
    photoURL: user.photoURL || '',
    city: 'Nao informado',
    joinedAt: new Date().toISOString().slice(0, 10),
    about: 'Perfil criado com login de usuario.',
  }
}

export async function getAvailableCategories() {
  const categories = [...new Set(getAllProducts().map((item) => item.category))]
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

  const filtered = getAllProducts().filter((product) => {
    const matchName = term ? product.title.toLowerCase().includes(term) : true
    const matchCategory = category ? product.category === category : true
    const matchPrice = product.price >= min && product.price <= max
    const matchCondition = condition ? product.condition === condition : true

    return matchName && matchCategory && matchPrice && matchCondition
  })

  return sortProducts(filtered, sortBy)
}

export async function getFreeProducts(limit = 8) {
  return getAllProducts()
    .filter((item) => item.price === 0)
    .sort(compareByCreatedAtDesc)
    .slice(0, limit)
}

export async function getRecentProducts(limit = 8) {
  return getAllProducts().sort(compareByCreatedAtDesc).slice(0, limit)
}

export async function getProductById(productId) {
  return getAllProducts().find((item) => item.id === productId) || null
}

export async function getSellerById(sellerId) {
  return seedSellers[sellerId] || null
}

export async function getSellerProducts(sellerId) {
  return getAllProducts().filter((item) => item.sellerId === sellerId)
}

export async function createProduct(payload, user) {
  if (!user) {
    throw new Error('Usuario nao autenticado')
  }

  const extra = safeRead(EXTRA_PRODUCTS_KEY, [])

  const newProduct = normalizeProduct({
    id: `product-${Date.now()}`,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    price: payload.price,
    photos: payload.photos,
    condition: payload.condition || 'usado',
    sellerId: user.uid,
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

  const extra = safeRead(EXTRA_PRODUCTS_KEY, [])
  const index = extra.findIndex((item) => item.id === productId)

  if (index < 0) {
    throw new Error('Somente anuncios criados por voce podem ser editados.')
  }

  const current = normalizeProduct(extra[index])

  if (current.sellerId !== user.uid) {
    throw new Error('Voce nao tem permissao para editar este anuncio.')
  }

  const updated = normalizeProduct({
    ...current,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    price: Number(payload.price),
    photos: payload.photos,
    condition: payload.condition || current.condition,
  })

  extra[index] = updated
  safeWrite(EXTRA_PRODUCTS_KEY, extra)

  return updated
}

export async function deleteProduct(productId, user) {
  if (!user) {
    throw new Error('Usuario nao autenticado')
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

  return seedSellers[user.uid] || sellerFromUser(user)
}

export async function getMyProducts(user) {
  if (!user) {
    return []
  }

  return getAllProducts().filter((item) => item.sellerId === user.uid)
}

export async function getFavoriteProducts(user) {
  if (!user) {
    return []
  }

  const favoriteIds = safeRead(buildFavoriteKey(user.uid), [])
  return getAllProducts().filter((item) => favoriteIds.includes(item.id))
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
