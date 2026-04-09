<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState, isAdminSession } from '../services/authService'
import { getProductById, isFavorite, reportProduct, toggleFavorite } from '../services/marketplaceService'

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
const isReporting = ref(false)
const showReportModal = ref(false)
const selectedReportReason = ref('')
const reportStatusMessage = ref('')
const reportStatusIsError = ref(false)

const reportOptions = [
  'Golpe',
  'Venda de itens ilícitos',
  'Violência, ódio, exploração',
  'Bullying ou assédio',
  'Nudez ou atividade sexual',
]

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
    return 'Não informado'
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

const canReportProduct = computed(() => {
  if (!user.value || !product.value || isOwnProduct.value) {
    return false
  }

  return true
})

const moderationStatusLabel = computed(() => {
  if (!product.value) {
    return ''
  }

  if (product.value.moderationStatus === 'pending') {
    return 'Anúncio aguardando aprovação'
  }

  if (product.value.moderationStatus === 'reported') {
    return 'Anúncio reportado para revisão'
  }

  if (product.value.moderationStatus === 'rejected') {
    return 'Anúncio rejeitado pela administração'
  }

  return ''
})

const showModerationStatus = computed(() => {
  if (!product.value || !moderationStatusLabel.value) {
    return false
  }

  return isOwnProduct.value || isAdminSession.value
})

const invalidProductPolicyMessage = computed(() => {
  if (!product.value || product.value.moderationStatus !== 'rejected') {
    return ''
  }

  const reason = String(product.value.moderationReason || '').trim() || 'Não informado'
  return `Anúncio denunciado por: ${reason}. Altere o anúncio para que possa ser avaliado novamente e publicado se estiver de acordo com as políticas da plataforma.`
})

const showInvalidProductPolicyMessage = computed(() =>
  Boolean(invalidProductPolicyMessage.value) && (isOwnProduct.value || isAdminSession.value),
)

async function loadProduct() {
  isLoading.value = true

  try {
    product.value = await getProductById(route.params.id, { viewer: user.value })

    if (!product.value) {
      await router.replace({ name: 'not-found' })
      return
    }

    selectedPhoto.value = product.value.photos[0] || ''
    thumbsLoaded.value = Object.fromEntries(
      product.value.photos.map((photo, index) => [buildThumbKey(photo, index), false]),
    )
    resetPhotoZoom()

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

function openReportModal() {
  if (!canReportProduct.value || isReporting.value) {
    return
  }

  selectedReportReason.value = ''
  showReportModal.value = true
}

function closeReportModal() {
  if (isReporting.value) {
    return
  }

  showReportModal.value = false
  selectedReportReason.value = ''
}

async function submitReport() {
  if (!product.value || !user.value || isReporting.value || !selectedReportReason.value) {
    return
  }

  isReporting.value = true
  reportStatusMessage.value = ''
  reportStatusIsError.value = false

  try {
    await reportProduct(product.value.id, user.value, selectedReportReason.value)
    closeReportModal()
    reportStatusMessage.value =
      'Obrigado pela denúncia. Ela será repassada a administração para devidas providências, se aplicável.'
    await loadProduct()
  } catch (err) {
    reportStatusMessage.value = err instanceof Error ? err.message : 'Falha ao reportar anúncio.'
    reportStatusIsError.value = true
  } finally {
    isReporting.value = false
  }
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
      <p>Carregando anúncio...</p>
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
          aria-label="Próxima foto"
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
        <div class="product-title-actions">
          <button
            v-if="canReportProduct"
            class="report-flag-btn"
            type="button"
            aria-label="Reportar anúncio"
            @click="openReportModal"
          >
            ⚑
          </button>

          <button
            class="favorite-star-btn"
            type="button"
            :aria-label="favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'"
            @click="handleFavorite"
          >
            <span :class="['favorite-star-icon', { active: favorite }]">{{ favorite ? '★' : '☆' }}</span>
          </button>
        </div>
      </div>

      <p class="product-price">{{ formattedPrice }}</p>
      <p v-if="showModerationStatus" class="muted" style="margin: 0 0 10px; color: #b45309">
        {{ moderationStatusLabel }}
      </p>

      <div class="product-details-list">
        <p><strong>Estado:</strong> {{ product.condition === 'novo' ? 'Novo' : 'Usado' }}</p>
        <p><strong>Categoria:</strong> {{ product.category }}</p>
        <p><strong>Descrição:</strong> </p>
        <p>{{ product.description }}</p>
        <p><strong>Localizacao:</strong> {{ productLocation }}</p>
        <p v-if="deliveryMethods.length"><strong>{{ deliveryMethods.join(' | ') }}</strong> </p>
      </div>

      <p v-if="showInvalidProductPolicyMessage" class="muted" style="color: #b45309; line-height: 1.5">
        {{ invalidProductPolicyMessage }}
      </p>

      <p
        v-if="reportStatusMessage"
        class="muted"
        :style="reportStatusIsError ? 'color: #b91c1c' : 'color: #166534'"
      >
        {{ reportStatusMessage }}
      </p>

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
          aria-label="Próxima foto"
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

  <Teleport to="body">
    <div v-if="showReportModal" class="report-modal-overlay" role="presentation" @click="closeReportModal">
      <article class="report-modal-card" role="dialog" aria-modal="true" @click.stop>
        <header class="report-modal-header">
          <h2>Reportar anúncio</h2>
          <button
            type="button"
            class="report-modal-close"
            :disabled="isReporting"
            aria-label="Fechar"
            @click="closeReportModal"
          >
            x
          </button>
        </header>

        <div class="report-modal-content">
          <p class="report-modal-message">Selecione um motivo para a denúncia:</p>

          <label v-for="option in reportOptions" :key="option" class="report-option-row">
            <input v-model="selectedReportReason" type="radio" :value="option" :disabled="isReporting" />
            <span>{{ option }}</span>
          </label>
        </div>

        <footer class="report-modal-actions">
          <button class="btn secondary" type="button" :disabled="isReporting" @click="closeReportModal">
            Cancelar
          </button>
          <button
            class="btn danger"
            type="button"
            :disabled="isReporting || !selectedReportReason"
            @click="submitReport"
          >
            {{ isReporting ? 'Submetendo...' : 'Submeter' }}
          </button>
        </footer>
      </article>
    </div>
  </Teleport>

  <section v-if="isLoading" class="card">
    <p class="muted">Carregando anúncio...</p>
  </section>

</template>

<style scoped>
.product-title-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-flag-btn {
  border: 1px solid #d1dce8;
  background: #fff;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 20px;
  color: #475569;
}

.report-flag-btn:hover {
  background: #f8fafc;
}

.report-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  z-index: 60;
  padding: 20px;
}

.report-modal-card {
  width: min(560px, 100%);
  background: #fff;
  border: 1px solid #dbe4ee;
  border-top: 5px solid #dc2626;
  border-radius: 18px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.24);
  overflow: hidden;
}

.report-modal-header {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.report-modal-header h2 {
  margin: 0;
  font-size: 20px;
  color: #0f172a;
}

.report-modal-close {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  color: #334155;
  width: 32px;
  height: 32px;
  cursor: pointer;
}

.report-modal-content {
  padding: 2px 16px 14px;
  display: grid;
  gap: 10px;
}

.report-modal-message {
  margin: 0;
  color: #1e293b;
  line-height: 1.5;
}

.report-option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #0f172a;
}

.report-modal-actions {
  border-top: 1px solid #e2e8f0;
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
