<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authState } from '../services/authService'
import { createProduct } from '../services/marketplaceService'

const router = useRouter()
const user = computed(() => authState.value)
const success = ref('')
const error = ref('')

const form = reactive({
  title: '',
  price: '',
  category: '',
  description: '',
  photos: '',
})

async function submitProduct() {
  success.value = ''
  error.value = ''

  try {
    const created = await createProduct(
      {
        title: form.title,
        price: Number(form.price),
        category: form.category,
        description: form.description,
        photos: form.photos.split(',').map((item) => item.trim()),
      },
      user.value,
    )

    success.value = 'Produto cadastrado com sucesso.'
    form.title = ''
    form.price = ''
    form.category = ''
    form.description = ''
    form.photos = ''

    router.push(`/product/${created.id}`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao cadastrar produto.'
  }
}
</script>

<template>
  <section class="card">
    <h1>Cadastrar Produto</h1>

    <form class="grid" style="gap: 10px; margin-top: 12px" @submit.prevent="submitProduct">
      <input v-model="form.title" type="text" required placeholder="Titulo" />
      <input v-model="form.price" type="number" required min="0" step="0.01" placeholder="Preco" />
      <input v-model="form.category" type="text" required placeholder="Categoria" />
      <textarea v-model="form.description" rows="5" required placeholder="Descricao"></textarea>
      <textarea
        v-model="form.photos"
        rows="3"
        placeholder="URLs de fotos separadas por virgula"
      ></textarea>

      <button class="btn" type="submit">Salvar produto</button>
    </form>

    <p v-if="success" style="color: #15803d; margin-top: 10px">{{ success }}</p>
    <p v-if="error" style="color: #b91c1c; margin-top: 10px">{{ error }}</p>
  </section>
</template>

<style scoped>
h1 {
  margin: 0;
}
</style>
