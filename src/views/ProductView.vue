<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState } from '../services/authService'
import { getProductById, isFavorite, toggleFavorite } from '../services/marketplaceService'

const route = useRoute()
const router = useRouter()
const user = computed(() => authState.value)

const product = ref(null)
const favorite = ref(false)
const isLoading = ref(false)
const selectedPhoto = ref('')
const selectedPhotoOrientation = ref('landscape')
const zoomLevel = ref(1)
const zoomOrigin = ref('50% 50%')
const isModalOpen = ref(false)
const thumbsLoaded = ref({})

const mainPhotoStyle = computed(() => ({
  transform: `scale(${zoomLevel.value})`,
  transformOrigin: zoomOrigin.value,
}))

const formattedPrice = computed(() => {
  if (!product.value) {
    return 'R$ 0,00'
  }

  return product.value.price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
})

const deliveryMethods = computed(() => {
  if (!product.value) {
    return []
  }

  const methods = []

  if (product.value.deliveryOptions?.retrieval) {
    methods.push('Aceita retirada')
  }

  if (product.value.deliveryOptions?.delivery) {
    methods.push('Aceita entrega')
  }

  return methods
})

const productLocation = computed(() => {
  if (!product.value) {
    return 'Nao informado'
  }

  const location = String(product.value.retrievalLocation || '').trim()
  return location || 'A combinar'
})

const isOwnProduct = computed(() => {
  if (!user.value || !product.value) {
    return false
  }

  return user.value.uid === product.value.sellerId
})

async function loadProduct() {
  isLoading.value = true

  try {
    product.value = await getProductById(route.params.id)

    if (product.value) {
      selectedPhoto.value = product.value.photos[0] || ''
      thumbsLoaded.value = Object.fromEntries(
        product.value.photos.map((photo, index) => [buildThumbKey(photo, index), false]),
      )
      resetPhotoZoom()
    }

    if (product.value && user.value) {
      favorite.value = await isFavorite(user.value, product.value.id)
    }
  } finally {
    isLoading.value = false
  }
}

function buildThumbKey(photo, index) {
  return `${photo}-${index}`
}

function handleThumbLoaded(photo, index) {
  const thumbKey = buildThumbKey(photo, index)
  thumbsLoaded.value = {
    ...thumbsLoaded.value,
    [thumbKey]: true,
  }
}

function selectPhoto(photo) {
  selectedPhoto.value = photo
  selectedPhotoOrientation.value = 'landscape'
  resetPhotoZoom()
}

function showPreviousPhoto() {
  if (!product.value?.photos?.length) {
    return
  }

  const currentIndex = product.value.photos.findIndex((photo) => photo === selectedPhoto.value)
  const safeIndex = currentIndex < 0 ? 0 : currentIndex
  const previousIndex = (safeIndex - 1 + product.value.photos.length) % product.value.photos.length
  selectedPhoto.value = product.value.photos[previousIndex]
  selectedPhotoOrientation.value = 'landscape'
  resetPhotoZoom()
}

function showNextPhoto() {
  if (!product.value?.photos?.length) {
    return
  }

  const currentIndex = product.value.photos.findIndex((photo) => photo === selectedPhoto.value)
  const safeIndex = currentIndex < 0 ? 0 : currentIndex
  const nextIndex = (safeIndex + 1) % product.value.photos.length
  selectedPhoto.value = product.value.photos[nextIndex]
  selectedPhotoOrientation.value = 'landscape'
  resetPhotoZoom()
}

function handleMainPhotoLoad(event) {
  const image = event.currentTarget

  if (!(image instanceof HTMLImageElement)) {
    return
  }

  selectedPhotoOrientation.value =
    image.naturalHeight > image.naturalWidth ? 'portrait' : 'landscape'
}

function resetPhotoZoom() {
  zoomLevel.value = 1
  zoomOrigin.value = '50% 50%'
}

function openPhotoModal() {
  isModalOpen.value = true
  resetPhotoZoom()
}

function handleModalPhotoClick(event) {
  const imageElement = event.currentTarget

  if (!(imageElement instanceof HTMLElement)) {
    return
  }

  const bounds = imageElement.getBoundingClientRect()
  const relativeX = ((event.clientX - bounds.left) / bounds.width) * 100
  const relativeY = ((event.clientY - bounds.top) / bounds.height) * 100

  zoomOrigin.value = `${Math.max(0, Math.min(100, relativeX))}% ${Math.max(0, Math.min(100, relativeY))}%`

  if (zoomLevel.value === 1) {
    zoomLevel.value = 3
    return
  }

  zoomLevel.value = 1
}

function closeModal() {
  isModalOpen.value = false
  zoomLevel.value = 1
  zoomOrigin.value = '50% 50%'
}

async function handleFavorite() {
  if (!user.value) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  favorite.value = await toggleFavorite(user.value, product.value.id)
}

function openSellerChat() {
  if (!product.value) {
    return
  }

  if (isOwnProduct.value) {
    router.push({ name: 'chat' })
    return
  }

  if (!user.value) {
    router.push({
      name: 'login',
      query: {
        redirect: `/chat?sellerId=${product.value.sellerId}&productId=${product.value.id}`,
      },
    })
    return
  }

  router.push({
    name: 'chat',
    query: {
      sellerId: product.value.sellerId,
      productId: product.value.id,
    },
  })
}

onMounted(() => {
  loadProduct()
})
</script>

<template>
  <section v-if="product" class="product-page-layout loading-section">
    <div v-if="isLoading" class="section-loading-overlay" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <p>Carregando anuncio...</p>
    </div>

    <article class="card product-gallery-card">
      <div v-if="selectedPhoto" class="product-main-photo-wrap">
        <img
          :src="selectedPhoto"
          :alt="product.title"
          class="product-main-photo"
          :class="[
            { zoomed: zoomLevel > 1 },
            selectedPhotoOrientation === 'portrait' ? 'photo-fit-portrait' : 'photo-fit-landscape',
          ]"
          :style="mainPhotoStyle"
          @load="handleMainPhotoLoad"
          @click="openPhotoModal"
        />

        <button
          v-if="product.photos.length > 1"
          type="button"
          class="gallery-nav prev"
          aria-label="Foto anterior"
          @click.stop="showPreviousPhoto"
        >
          ‹
        </button>

        <button
          v-if="product.photos.length > 1"
          type="button"
          class="gallery-nav next"
          aria-label="Proxima foto"
          @click.stop="showNextPhoto"
        >
          ›
        </button>
      </div>
      <div v-else class="product-main-photo-wrap no-photo">Sem foto</div>

      <div v-if="product.photos.length > 1" class="product-thumbs-row">
        <button
          v-for="(photo, index) in product.photos"
          :key="`${photo}-${index}`"
          class="product-thumb-btn"
          :class="{
            active: selectedPhoto === photo,
            loading: !thumbsLoaded[buildThumbKey(photo, index)],
          }"
          type="button"
          @click="selectPhoto(photo)"
        >
          <img :src="photo" :alt="`${product.title} ${index + 1}`" @load="handleThumbLoaded(photo, index)" />
          <span v-if="!thumbsLoaded[buildThumbKey(photo, index)]" class="thumb-loading-overlay">
            <span class="thumb-spinner" aria-hidden="true"></span>
          </span>
        </button>
      </div>
    </article>

    <article class="card product-info-card">
      <div class="product-title-row">
        <h1>{{ product.title }}</h1>
        <button
          class="favorite-star-btn"
          type="button"
          :aria-label="favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'"
          @click="handleFavorite"
        >
          <span :class="['favorite-star-icon', { active: favorite }]">{{ favorite ? '★' : '☆' }}</span>
        </button>
      </div>

      <p class="product-price">{{ formattedPrice }}</p>

      <div class="product-details-list">
        <p><strong>Estado:</strong> {{ product.condition === 'novo' ? 'Novo' : 'Usado' }}</p>
        <p><strong>Categoria:</strong> {{ product.category }}</p>
        <p><strong>Descricao:</strong> </p>
        <p>{{ product.description }}</p>
        <p><strong>Localizacao:</strong> {{ productLocation }}</p>
        <p v-if="deliveryMethods.length"><strong>{{ deliveryMethods.join(' | ') }}</strong> </p>
      </div>

      <div class="product-bottom-actions">
        <button class="btn secondary" type="button" @click="openSellerChat">
          {{ isOwnProduct ? 'Minhas conversas' : 'Falar com Vendedor' }}
        </button>
        <RouterLink class="btn" :to="`/seller/${product.sellerId}`">Ver vendedor</RouterLink>
      </div>
    </article>
  </section>

  <!-- Modal de visualização ampliada -->
  <div v-if="isModalOpen && product" class="photo-modal">
    <button
      class="photo-modal-close"
      @click="closeModal"
      aria-label="Fechar modal"
    >
      ✕
    </button>

    <div class="photo-modal-content">
      <div class="photo-modal-viewer">
        <img
          :src="selectedPhoto"
          :alt="product.title"
          class="photo-modal-image"
          :class="[
            selectedPhotoOrientation === 'portrait' ? 'photo-fit-portrait' : 'photo-fit-landscape',
          ]"
          :style="mainPhotoStyle"
          @click="handleModalPhotoClick"
        />

        <button
          v-if="product.photos.length > 1"
          type="button"
          class="gallery-nav prev"
          aria-label="Foto anterior"
          @click.stop="showPreviousPhoto"
        >
          ‹
        </button>

        <button
          v-if="product.photos.length > 1"
          type="button"
          class="gallery-nav next"
          aria-label="Proxima foto"
          @click.stop="showNextPhoto"
        >
          ›
        </button>
      </div>

      <div v-if="product.photos.length > 1" class="photo-modal-gallery">
        <button
          v-for="(photo, index) in product.photos"
          :key="`modal-${photo}-${index}`"
          class="photo-modal-thumb"
          :class="{ active: selectedPhoto === photo }"
          type="button"
          @click="selectPhoto(photo)"
        >
          <img :src="photo" :alt="`${product.title} ${index + 1}`" />
        </button>
      </div>
    </div>
  </div>

</template>
