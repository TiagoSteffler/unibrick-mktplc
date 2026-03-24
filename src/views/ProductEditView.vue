<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState } from '../services/authService'
import { deleteProduct, getProductById, updateProduct } from '../services/marketplaceService'

const route = useRoute()
const router = useRouter()
const user = computed(() => authState.value)
const loading = ref(true)
const error = ref('')

const form = reactive({
  title: '',
  price: '',
  category: '',
  description: '',
  photos: '',
  condition: 'usado',
})

async function loadProduct() {
  loading.value = true
  error.value = ''

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
  form.category = product.category
  form.description = product.description
  form.photos = product.photos.join(', ')
  form.condition = product.condition || 'usado'
  loading.value = false
}

async function submitEdit() {
  error.value = ''

  try {
    const updated = await updateProduct(
      route.params.id,
      {
        title: form.title,
        price: Number(form.price),
        category: form.category,
        description: form.description,
        photos: form.photos.split(',').map((item) => item.trim()).filter(Boolean),
        condition: form.condition,
      },
      user.value,
    )

    router.push(`/product/${updated.id}`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao editar anuncio.'
  }
}

async function handleDelete() {
  const confirmed = window.confirm('Deseja mesmo excluir este produto?')

  if (!confirmed) {
    return
  }

  try {
    await deleteProduct(route.params.id, user.value)
    router.push('/my/products')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao excluir anuncio.'
  }
}

onMounted(() => {
  loadProduct()
})
</script>

<template>
  <section class="card" v-if="!loading && !error">
    <h1>Editar Anuncio</h1>

    <form class="grid" style="gap: 10px; margin-top: 12px" @submit.prevent="submitEdit">
      <input v-model="form.title" type="text" required placeholder="Titulo" />
      <input v-model="form.price" type="number" required min="0" step="0.01" placeholder="Preco" />
      <input v-model="form.category" type="text" required placeholder="Categoria" />

      <select v-model="form.condition" required>
        <option value="novo">Novo</option>
        <option value="usado">Usado</option>
      </select>

      <textarea v-model="form.description" rows="5" required placeholder="Descricao"></textarea>
      <textarea
        v-model="form.photos"
        rows="3"
        placeholder="URLs de fotos separadas por virgula"
      ></textarea>

      <div style="display: flex; gap: 8px; flex-wrap: wrap">
        <button class="btn" type="submit">Salvar alteracoes</button>
        <button class="btn danger" type="button" @click="handleDelete">Excluir anuncio</button>
        <RouterLink class="btn secondary" :to="`/my/products`">Cancelar</RouterLink>
      </div>
    </form>
  </section>

  <section class="card" v-else-if="loading">
    <p class="muted">Carregando anuncio...</p>
  </section>

  <section class="card" v-else>
    <p style="color: #b91c1c">{{ error }}</p>
    <RouterLink class="btn secondary" to="/my/products">Voltar</RouterLink>
  </section>
</template>

<style scoped>
h1 {
  margin: 0;
}

.btn.danger {
  background: #b91c1c;
}
</style>
