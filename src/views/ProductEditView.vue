<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState } from '../services/authService'
import AppModal from '../components/AppModal.vue'
import { deleteProduct, getProductById, getUserProfile, updateProduct } from '../services/marketplaceService'
import { PRODUCT_CATEGORIES, RETRIEVAL_LOCATIONS } from '../constants/productOptions'
import { optimizeMarketplaceImage } from '../utils/imageOptimizer'

const route = useRoute()
const router = useRouter()
const user = computed(() => authState.value)
const userProfile = computed(() => getUserProfile(user.value))

const loading = ref(true)
const error = ref('')
const isSubmitting = ref(false)
const isDeleting = ref(false)
const showSuccessModal = ref(false)
const showDeleteConfirmModal = ref(false)
const redirectAfterSave = ref('')

const photos = ref([])
const previewPhotos = ref([])
const existingPhotoUrls = ref([])
const MAX_PHOTOS = 5

const isBusy = computed(() => isSubmitting.value || isDeleting.value || loading.value)

const dynamicRetrievalLocation = computed(() => {
  const customLocation = userProfile.value?.neighborhood || ''
  return customLocation ? `<${customLocation}>` : '<Bairro salvo no perfil>'
})

const form = reactive({
  title: '',
  price: '',
  priceDisplay: 'R$ 0,00',
  category: '',
  description: '',
  condition: 'usado',
  deliveryOptions: {
    delivery: false,
    retrieval: true,
  },
  retrievalLocation: 'UFSM',
})

const MAX_PRICE_CENTS = 999999

function clampPriceFromInput(rawValue) {
  const onlyDigits = String(rawValue || '').replace(/\D/g, '').slice(0, 6)
  const normalizedDigits = onlyDigits || '0'
  const cents = Math.min(Number.parseInt(normalizedDigits, 10) || 0, MAX_PRICE_CENTS)

  form.priceDisplay = formatPriceDisplay(cents / 100)
  form.price = (cents / 100).toFixed(2)
}

function formatPriceDisplay(numericPrice) {
  return numericPrice.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPriceInput(event) {
  clampPriceFromInput(event.target.value)
  event.target.value = form.priceDisplay
}

function handlePriceKeydown(event) {
  if (event.key === 'Backspace' || event.key === 'Delete') {
     let value = form.priceDisplay.replace(/\D/g, '')
     if (value.length > 0) {
        value = value.slice(0, -1)
        if (!value) value = '0'
        
        const numericValue = parseInt(value, 10)

          clampPriceFromInput(String(numericValue))
        event.preventDefault()
     }
  }
}

function handlePriceFocus(event) {
  const el = event.target
  setTimeout(() => {
    el.selectionStart = el.selectionEnd = el.value.length
  }, 0)
}

async function loadProduct() {
  loading.value = true
  error.value = ''

  try {
    const product = await getProductById(route.params.id)

    if (!product) {
      error.value = 'Anuncio nao encontrado.'
      loading.value = false
      return
    }

    if (!user.value || product.sellerId !== user.value.uid) {
      error.value = 'Voce nao pode editar este anuncio.'
      loading.value = false
      return
    }

    form.title = product.title
    form.price = String(product.price)
    form.priceDisplay = formatPriceDisplay(product.price)
    form.category = product.category
    form.description = product.description
    form.condition = product.condition || 'usado'
    
    if (product.deliveryOptions) {
      form.deliveryOptions = { ...product.deliveryOptions }
    }
    
    if (product.retrievalLocation) {
      form.retrievalLocation = product.retrievalLocation
    }
    
    existingPhotoUrls.value = Array.isArray(product.photos) ? [...product.photos] : []
    previewPhotos.value = [...existingPhotoUrls.value]
    
  } catch (err) {
    error.value = 'Erro ao carregar produto.'
  } finally {
    loading.value = false
  }
}

function removePhoto(index) {
  if (isBusy.value) {
    return
  }
  
  if (index < existingPhotoUrls.value.length) {
    existingPhotoUrls.value.splice(index, 1)
  } else {
    const newPhotoIndex = index - existingPhotoUrls.value.length
    photos.value.splice(newPhotoIndex, 1)
  }
  
  previewPhotos.value.splice(index, 1)
}

async function handlePhotosChange(event) {
  if (isBusy.value) {
    event.target.value = ''
    return
  }

  const selected = Array.from(event.target.files || [])

  await processSelectedPhotos(selected)
  event.target.value = ''
}

async function processSelectedPhotos(selected) {
  if (isBusy.value) {
    return
  }

  if (!selected.length) {
    return
  }

  error.value = ''

  const availableSlots = MAX_PHOTOS - previewPhotos.value.length

  if (availableSlots <= 0) {
    error.value = `Voce pode enviar no maximo ${MAX_PHOTOS} fotos.`
    return
  }

  const filesToRead = selected.slice(0, availableSlots)

  try {
    const optimizedFiles = await Promise.all(filesToRead.map((file) => optimizeMarketplaceImage(file)))
    photos.value.push(...optimizedFiles.map((item) => item.file))
    previewPhotos.value.push(...optimizedFiles.map((item) => item.previewDataUrl))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao carregar imagens.'
  }
}

async function handlePhotoDrop(event) {
  if (isBusy.value) {
    return
  }

  event.preventDefault()
  const dropped = Array.from(event.dataTransfer?.files || [])
  await processSelectedPhotos(dropped)
}

function handleSuccessConfirm() {
  if (!redirectAfterSave.value) {
    return
  }

  router.push(redirectAfterSave.value)
}

async function submitEdit() {
  if (isBusy.value) {
    return
  }

  error.value = ''

  if (previewPhotos.value.length < 1) {
    error.value = 'Inclua pelo menos uma foto para manter o anuncio ativo.'
    return
  }

  const numericPrice = Number(form.price)

  if (!Number.isFinite(numericPrice) || numericPrice < 0 || numericPrice > 9999.99) {
    error.value = 'O preco deve estar entre R$ 0,00 e R$ 9.999,99.'
    return
  }

  isSubmitting.value = true

  try {
    const updated = await updateProduct(
      route.params.id,
      {
        title: form.title,
        price: Number(form.price),
        category: form.category,
        description: form.description,
        condition: form.condition,
        deliveryOptions: { ...form.deliveryOptions },
        retrievalLocation: form.deliveryOptions.retrieval ? form.retrievalLocation : '',
        photos: [...existingPhotoUrls.value, ...previewPhotos.value.slice(existingPhotoUrls.value.length)],
        photoFiles: [...photos.value],
      },
      user.value,
    )

    redirectAfterSave.value = `/product/${updated.id}`
    showSuccessModal.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao editar anuncio.'
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete() {
  if (isBusy.value) {
    return
  }

  showDeleteConfirmModal.value = true
}

async function confirmDelete() {
  showDeleteConfirmModal.value = false
  
  isDeleting.value = true
  error.value = ''

  try {
    await deleteProduct(route.params.id, user.value)
    router.push('/my/products')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao excluir anuncio.'
    isDeleting.value = false
  }
}

onMounted(() => {
  loadProduct()
})

</script>

<template>
  <section v-if="error && !form.title" class="card">
    <p class="status-message error">{{ error }}</p>
    <div class="action-row">
      <RouterLink class="btn secondary" to="/my/products">Voltar para meus produtos</RouterLink>
    </div>
  </section>
  
  <section v-else class="card product-create-card loading-section" :class="{ busy: isBusy }">
    <div v-if="loading || isSubmitting || isDeleting || isRedirecting" class="section-loading-overlay" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <p v-if="loading">Carregando anuncio...</p>
      <p v-else-if="isDeleting">Excluindo anuncio...</p>
      <p v-else>Salvando alteracoes e enviando imagens...</p>
    </div>

    <h1>Editar Produto</h1>

    <form class="product-form-layout" @submit.prevent="submitEdit" :aria-busy="isSubmitting">
      <fieldset class="product-fieldset" :disabled="isBusy">
        <div class="stack-md">
        <label class="field">
          <span>Titulo do anuncio</span>
          <input v-model="form.title" type="text" required placeholder="Ex.: Notebook Acer" />
        </label>

        <label class="field">
          <span>Descricao</span>
          <textarea
            v-model="form.description"
            rows="6"
            required
            placeholder="Descreva estado, itens inclusos e detalhes relevantes"
          ></textarea>
        </label>

        <label class="field">
          <span>Preco</span>
          <input 
            v-model="form.priceDisplay" 
            type="text" 
            required 
            @input="formatPriceInput" 
            @keydown="handlePriceKeydown"
            @focus="handlePriceFocus"
            @click="handlePriceFocus"
          />
        </label>

        <label class="field">
          <span>Categoria</span>
          <select v-model="form.category" required>
            <option value="" disabled selected>Selecione uma categoria</option>
            <option v-for="cat in PRODUCT_CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </label>

        <label class="field">
          <span>Estado de conservacao</span>
          <select v-model="form.condition" required>
            <option value="usado">Usado</option>
            <option value="novo">Novo</option>
          </select>
        </label>
        
        <fieldset class="field" style="border: none; padding: 0; margin-top: 8px;">
          <legend style="margin-bottom: 8px;">Metodos de entrega</legend>
          <div style="display: flex; gap: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" v-model="form.deliveryOptions.delivery" />
              <span>Entrega</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" v-model="form.deliveryOptions.retrieval" />
              <span>Retirada</span>
            </label>
          </div>
        </fieldset>

        <label class="field" v-if="form.deliveryOptions.retrieval">
          <span>Local de retirada</span>
          <select v-model="form.retrievalLocation" required>
            <option :value="RETRIEVAL_LOCATIONS[0]">{{ RETRIEVAL_LOCATIONS[0] }}</option>
            <option value="bairro">{{ dynamicRetrievalLocation }}</option>
            <option :value="RETRIEVAL_LOCATIONS[1]">{{ RETRIEVAL_LOCATIONS[1] }}</option>
          </select>
        </label>
        </div>

        <div class="stack-md">
          <div class="field">
            <span style="max-height: fit-content;">Imagens ({{ previewPhotos.length }}/{{ MAX_PHOTOS }})</span>
            <label class="upload-zone" :class="{ disabled: previewPhotos.length >= MAX_PHOTOS || isBusy }">
              <input
                type="file"
                accept="image/*"
                multiple
                :disabled="previewPhotos.length >= MAX_PHOTOS || isBusy"
                @change="handlePhotosChange"
              />
              <span
                class="drop-target"
                @dragenter.prevent
                @dragover.prevent
                @drop.prevent="handlePhotoDrop"
              ></span>
              <strong>Arraste ou clique para adicionar mais</strong>
              <small class="muted">Maximo {{ MAX_PHOTOS }} arquivos no total.</small>
            </label>
          </div>

          <div v-if="previewPhotos.length" class="photo-preview-grid">
            <div v-for="(photo, index) in previewPhotos" :key="`${photo}-${index}`" class="photo-chip">
              <img :src="photo" :alt="`Foto ${index + 1}`" />
              <button type="button" class="btn danger" @click="removePhoto(index)" :disabled="isBusy">Remover</button>
            </div>
          </div>
        </div>

        <div class="action-row align-end full-width">
          <RouterLink to="/my/products" class="btn secondary" :class="{ disabled: isBusy }">
            Cancelar
          </RouterLink>
          <button type="button" class="btn danger" @click="handleDelete" :disabled="isBusy">
            {{ isDeleting ? 'Excluindo...' : 'Excluir anuncio' }}
          </button>
          <button class="btn" type="submit" :disabled="isBusy">
            {{ isSubmitting ? 'Salvando...' : 'Salvar alteracoes' }}
          </button>
        </div>
      </fieldset>
    </form>

    <p v-if="error" class="status-message error">{{ error }}</p>

    <AppModal
      v-model="showDeleteConfirmModal"
      variant="danger"
      title="Excluir anuncio"
      message="Tem certeza que deseja excluir este anuncio? Esta acao nao pode ser desfeita."
      confirm-text="Excluir anuncio"
      cancel-text="Cancelar"
      @confirm="confirmDelete"
    />

    <AppModal
      v-model="showSuccessModal"
      variant="info"
      title="Edicao concluida"
      message="Seu anuncio foi atualizado com sucesso."
      :details="['As alteracoes ja estao disponiveis na pagina do produto.']"
      confirm-text="Ir para o anuncio"
      cancel-text="Ficar na edicao"
      @confirm="handleSuccessConfirm"
    />
  </section>
</template>
