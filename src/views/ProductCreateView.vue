<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authState } from '../services/authService'
import { createProduct } from '../services/marketplaceService'

const router = useRouter()
const user = computed(() => authState.value)
const success = ref('')
const error = ref('')
const isSubmitting = ref(false)
const isRedirecting = ref(false)
const photos = ref([])
const previewPhotos = ref([])
const MAX_PHOTOS = 5
let redirectTimer = null

const isBusy = computed(() => isSubmitting.value || isRedirecting.value)

const form = reactive({
  title: '',
  price: '',
  category: '',
  description: '',
  condition: 'usado',
})

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao processar imagem.'))
    reader.readAsDataURL(file)
  })
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

  if (!selected.length) {
    return
  }

  error.value = ''

  const availableSlots = MAX_PHOTOS - photos.value.length

  if (availableSlots <= 0) {
    error.value = `Voce pode enviar no maximo ${MAX_PHOTOS} fotos.`
    event.target.value = ''
    return
  }

  const filesToRead = selected.slice(0, availableSlots)

  try {
    const encoded = await Promise.all(filesToRead.map((file) => readFileAsDataURL(file)))
    photos.value.push(...filesToRead)
    previewPhotos.value.push(...encoded)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao carregar imagens.'
  } finally {
    event.target.value = ''
  }
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
  if (redirectTimer) {
    clearTimeout(redirectTimer)
    redirectTimer = null
  }

  router.push('/my/products')
}

function scheduleRedirect() {
  isRedirecting.value = true

  redirectTimer = setTimeout(() => {
    goToMyProducts()
  }, 2500)
}

async function submitProduct() {
  if (isBusy.value) {
    return
  }

  success.value = ''
  error.value = ''

  if (photos.value.length < 1) {
    error.value = 'Inclua pelo menos uma foto para publicar o anuncio.'
    return
  }

  isSubmitting.value = true

  try {
    await createProduct(
      {
        title: form.title,
        price: Number(form.price),
        category: form.category,
        description: form.description,
        condition: form.condition,
        photos: [...previewPhotos.value],
        photoFiles: [...photos.value],
      },
      user.value,
    )

    success.value = 'Produto cadastrado com sucesso! Redirecionando para Meus Produtos...'
    resetForm()
    scheduleRedirect()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao cadastrar produto.'
  } finally {
    isSubmitting.value = false
  }
}

onBeforeUnmount(() => {
  if (redirectTimer) {
    clearTimeout(redirectTimer)
  }
})
</script>

<template>
  <section class="card product-create-card" :class="{ busy: isBusy }">
    <h1>Cadastrar Produto</h1>

    <form class="product-form-layout" @submit.prevent="submitProduct" :aria-busy="isSubmitting">
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
          <input v-model="form.price" type="number" required min="0" step="0.01" placeholder="0,00" />
        </label>

        <label class="field">
          <span>Categoria</span>
          <input v-model="form.category" type="text" required placeholder="Ex.: Eletronicos" />
        </label>

        <label class="field">
          <span>Estado de conservacao</span>
          <select v-model="form.condition" required>
            <option value="usado">Usado</option>
            <option value="novo">Novo</option>
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
              <strong>Arraste ou clique para selecionar</strong>
              <small class="muted">Minimo 1 foto e maximo {{ MAX_PHOTOS }} arquivos.</small>
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
      <p>Enviando imagens e salvando anuncio...</p>
    </div>

    <p v-if="error" class="status-message error">{{ error }}</p>

    <div v-if="success" class="status-message success stack-sm">
      <p>{{ success }}</p>
      <div class="action-row">
        <button type="button" class="btn secondary" @click="goToMyProducts">
          OK, ir para meus produtos
        </button>
      </div>
    </div>
  </section>
</template>
