<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authState } from '../services/authService'
import AppModal from '../components/AppModal.vue'
import { createProduct, getUserProfile } from '../services/marketplaceService'
import { PRODUCT_CATEGORIES, RETRIEVAL_LOCATIONS } from '../constants/productOptions'
import { optimizeMarketplaceImage } from '../utils/imageOptimizer'

const router = useRouter()
const user = computed(() => authState.value)
const userProfile = computed(() => getUserProfile(user.value))

const error = ref('')
const isSubmitting = ref(false)
const showSuccessModal = ref(false)
const photos = ref([])
const previewPhotos = ref([])
const wasSavedLocally = ref(false)
const submittedModerationStatus = ref('approved')
const MAX_PHOTOS = 5

const isBusy = computed(() => isSubmitting.value)
const successModalTitle = computed(() =>
  wasSavedLocally.value ? 'Anúncio salvo localmente' : 'Anúncio publicado',
)
const successModalMessage = computed(() =>
  wasSavedLocally.value
    ? 'Não foi possível enviar imagens ao Firebase Storage. O anúncio foi salvo apenas neste navegador.'
    : submittedModerationStatus.value === 'pending'
      ? 'Seu anúncio foi enviado e agora aguarda aprovação da administração.'
      : 'Seu anúncio foi publicado com sucesso.',
)
const successModalDetails = computed(() =>
  wasSavedLocally.value
    ? [
        'Verifique regras/CORS do Firebase Storage para sincronizar novos anúncios com a nuvem.',
        'Depois da correção, cadastre novamente para publicar no Firestore.',
      ]
    : submittedModerationStatus.value === 'pending'
      ? [
          'Enquanto estiver pendente, somente você e administradores conseguem visualizar o anúncio.',
          'Assim que for aprovado, ele aparecerá para todos na busca e na página inicial.',
        ]
      : ['As fotos foram processadas e salvas.', 'Você já pode gerenciar o anúncio em Meus Produtos.'],
)

const dynamicRetrievalLocation = computed(() => {
  const customLocation = userProfile.value?.neighborhood || ''
  return customLocation ? `${customLocation}` : 'Bairro salvo no perfil'
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

  const formatted = (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  form.priceDisplay = formatted
  form.price = (cents / 100).toFixed(2)
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

function removePhoto(index) {
  if (isBusy.value) {
    return
  }

  photos.value.splice(index, 1)
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

  const availableSlots = MAX_PHOTOS - photos.value.length

  if (availableSlots <= 0) {
    error.value = `Você pode enviar no máximo ${MAX_PHOTOS} fotos.`
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

function resetForm() {
  form.title = ''
  form.price = ''
  form.category = ''
  form.description = ''
  form.condition = 'usado'
  photos.value = []
  previewPhotos.value = []
}

function goToMyProducts() {
  router.push('/my/products')
}

async function submitProduct() {
  if (isBusy.value) {
    return
  }

  error.value = ''
  wasSavedLocally.value = false
  submittedModerationStatus.value = 'approved'

  if (photos.value.length < 1) {
    error.value = 'Inclua pelo menos uma foto para publicar o anúncio.'
    return
  }

  const numericPrice = Number(form.price)

  if (!Number.isFinite(numericPrice) || numericPrice < 0 || numericPrice > 9999.99) {
    error.value = 'O preço deve estar entre R$ 0,00 e R$ 9.999,99.'
    return
  }

  isSubmitting.value = true

  try {
    const created = await createProduct(
      {
        title: form.title,
        price: Number(form.price),
        category: form.category,
        description: form.description,
        condition: form.condition,
        deliveryOptions: { ...form.deliveryOptions },
        retrievalLocation: form.deliveryOptions.retrieval ? form.retrievalLocation : '',
        photos: [...previewPhotos.value],
        photoFiles: [...photos.value],
      },
      user.value,
    )

    wasSavedLocally.value =
      created?.storageMode === 'local-fallback' || created?.storageMode === 'local'
    submittedModerationStatus.value = String(created?.moderationStatus || 'approved')

    resetForm()
    showSuccessModal.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao cadastrar produto.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="card product-create-card" :class="{ busy: isBusy }">
    <h1>Cadastrar Produto</h1>

    <form class="product-form-layout" @submit.prevent="submitProduct" :aria-busy="isSubmitting">
      <fieldset class="product-fieldset" :disabled="isBusy">
        <div class="stack-md">
        <label class="field">
          <span>Título do anúncio</span>
          <input v-model="form.title" type="text" required placeholder="Ex.: Notebook Acer" />
        </label>

        <label class="field">
          <span>Descrição</span>
          <textarea
            v-model="form.description"
            rows="6"
            required
            placeholder="Descreva estado, itens inclusos e detalhes relevantes"
          ></textarea>
        </label>

        <label class="field">
          <span>Preço</span>
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
          <span>Estado de conservação</span>
          <select v-model="form.condition" required>
            <option value="usado">Usado</option>
            <option value="novo">Novo</option>
          </select>
        </label>
        
        <fieldset class="field" style="border: none; padding: 0; margin-top: 8px;">
          <legend style="margin-bottom: 8px;">Métodos de entrega</legend>
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
            <span>Imagens ({{ previewPhotos.length }}/{{ MAX_PHOTOS }})</span>
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
              <strong>Arraste ou clique para selecionar</strong>
              <small class="muted">Mínimo 1 foto e máximo {{ MAX_PHOTOS }} arquivos.</small>
            </label>
          </div>

          <div v-if="previewPhotos.length" class="photo-preview-grid">
            <div v-for="(photo, index) in previewPhotos" :key="`${photo}-${index}`" class="photo-chip">
              <img :src="photo" :alt="`Foto ${index + 1}`" />
              <button type="button" class="btn danger" @click="removePhoto(index)">Remover</button>
            </div>
          </div>
        </div>

        <div class="action-row align-end full-width">
          <RouterLink to="/my/products" class="btn secondary" :class="{ disabled: isBusy }">
            Cancelar
          </RouterLink>
          <button class="btn" type="submit" :disabled="isBusy">
            {{ isSubmitting ? 'Salvando...' : 'Salvar produto' }}
          </button>
        </div>
      </fieldset>
    </form>

    <div v-if="isSubmitting" class="loading-overlay" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <p>Enviando imagens e salvando anúncio...</p>
    </div>

    <p v-if="error" class="status-message error">{{ error }}</p>

    <AppModal
      v-model="showSuccessModal"
      variant="info"
      :title="successModalTitle"
      :message="successModalMessage"
      :details="successModalDetails"
      confirm-text="Ir para meus produtos"
      cancel-text="Continuar aqui"
      @confirm="goToMyProducts"
    />
  </section>
</template>
