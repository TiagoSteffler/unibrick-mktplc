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
const selectedPhoto = ref('')

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

async function loadProduct() {
  product.value = await getProductById(route.params.id)

  if (product.value) {
    selectedPhoto.value = product.value.photos[0] || ''
  }

  if (product.value && user.value) {
    favorite.value = await isFavorite(user.value, product.value.id)
  } 
}

function selectPhoto(photo) {
  selectedPhoto.value = photo
}

function showPreviousPhoto() {
  if (!product.value?.photos?.length) {
    return
  }

  const currentIndex = product.value.photos.findIndex((photo) => photo === selectedPhoto.value)
  const safeIndex = currentIndex < 0 ? 0 : currentIndex
  const previousIndex = (safeIndex - 1 + product.value.photos.length) % product.value.photos.length
  selectedPhoto.value = product.value.photos[previousIndex]
}

function showNextPhoto() {
  if (!product.value?.photos?.length) {
    return
  }

  const currentIndex = product.value.photos.findIndex((photo) => photo === selectedPhoto.value)
  const safeIndex = currentIndex < 0 ? 0 : currentIndex
  const nextIndex = (safeIndex + 1) % product.value.photos.length
  selectedPhoto.value = product.value.photos[nextIndex]
}

async function handleFavorite() {
  if (!user.value) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  favorite.value = await toggleFavorite(user.value, product.value.id)
}

onMounted(() => {
  loadProduct()
})
</script>

<template>
  <section v-if="product" class="product-page-layout">
    <article class="card product-gallery-card">
      <div v-if="selectedPhoto" class="product-main-photo-wrap">
        <img :src="selectedPhoto" :alt="product.title" class="product-main-photo" />

        <button
          v-if="product.photos.length > 1"
          type="button"
          class="gallery-nav prev"
          aria-label="Foto anterior"
          @click="showPreviousPhoto"
        >
          ‹
        </button>

        <button
          v-if="product.photos.length > 1"
          type="button"
          class="gallery-nav next"
          aria-label="Proxima foto"
          @click="showNextPhoto"
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
          :class="{ active: selectedPhoto === photo }"
          type="button"
          @click="selectPhoto(photo)"
        >
          <img :src="photo" :alt="`${product.title} ${index + 1}`" />
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
        <RouterLink class="btn secondary" :to="`/seller/${product.sellerId}?action=contact`">
          Falar com Vendedor
        </RouterLink>
        <RouterLink class="btn" :to="`/seller/${product.sellerId}`">Ver vendedor</RouterLink>
      </div>
    </article>
  </section>

  <p v-else class="card muted">Produto nao encontrado.</p>
</template>
