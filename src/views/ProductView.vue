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

async function loadProduct() {
  product.value = await getProductById(route.params.id)

  if (product.value && user.value) {
    favorite.value = await isFavorite(user.value, product.value.id)
  }
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
  <section v-if="product" class="grid" style="gap: 14px">
    <article class="card">
      <h1>{{ product.title }}</h1>
      <p class="muted">Categoria: {{ product.category }}</p>
      <p class="price">R$ {{ product.price.toFixed(2) }}</p>
      <p>{{ product.description }}</p>

      <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap">
        <button class="btn" type="button" @click="handleFavorite">
          {{ favorite ? 'Desfavoritar' : 'Favoritar' }}
        </button>
        <RouterLink class="btn secondary" :to="`/seller/${product.sellerId}`">Ver vendedor</RouterLink>
      </div>
    </article>

    <section class="grid photos">
      <img v-for="photo in product.photos" :key="photo" :src="photo" :alt="product.title" class="photo" />
    </section>
  </section>

  <p v-else class="card muted">Produto nao encontrado.</p>
</template>

<style scoped>
h1 {
  margin: 0;
}

.price {
  font-size: 24px;
  font-weight: 700;
  margin: 8px 0;
}

.photos {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.photo {
  width: 100%;
  border-radius: 12px;
  min-height: 220px;
  object-fit: cover;
}
</style>
