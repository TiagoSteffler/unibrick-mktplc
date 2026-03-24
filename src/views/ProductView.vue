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
      <h1>{{ product.title }}</h1>
      <p class="product-price">R$ {{ product.price.toFixed(2) }}</p>
      <p><strong>Categoria:</strong> {{ product.category }}</p>
      <p><strong>Estado:</strong> {{ product.condition === 'novo' ? 'Novo' : 'Usado' }}</p>
      <p><strong>Anunciado em:</strong> {{ product.createdAt }}</p>
      <p class="muted product-description">{{ product.description }}</p>

      <div class="action-row product-actions">
        <button class="btn" type="button" @click="handleFavorite">
          {{ favorite ? 'Desfavoritar' : 'Favoritar' }}
        </button>
        <RouterLink class="btn secondary" :to="`/seller/${product.sellerId}`">Ver vendedor</RouterLink>
      </div>
    </article>
  </section>

  <p v-else class="card muted">Produto nao encontrado.</p>
</template>
