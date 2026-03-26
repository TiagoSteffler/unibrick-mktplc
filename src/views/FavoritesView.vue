<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ProductCard from '../components/ProductCard.vue'
import { authState } from '../services/authService'
import { getFavoriteProducts } from '../services/marketplaceService'

const router = useRouter()
const user = computed(() => authState.value)
const favorites = ref([])
const isLoading = ref(false)

async function loadFavorites() {
  isLoading.value = true

  try {
    favorites.value = await getFavoriteProducts(user.value)
  } finally {
    isLoading.value = false
  }
}

function goToProducts() {
  router.push('/search')
}

onMounted(() => {
  loadFavorites()
})
</script>

<template>
  <section class="grid" style="gap: 14px">
    <article class="card">
      <h1>Produtos Favoritados</h1>
      <p class="muted">Itens salvos para acompanhar depois.</p>
    </article>

    <section class="loading-section favorites-products-section">
      <div v-if="isLoading" class="section-loading-overlay" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <p>Carregando favoritos...</p>
      </div>

      <section class="grid products" v-if="favorites.length">
        <ProductCard v-for="product in favorites" :key="product.id" :product="product" />
      </section>

      <article v-else class="card muted">
        Nenhum favorito salvo ainda.
        <button class="btn secondary" style="margin-left: 10px" type="button" @click="goToProducts">
          Ver produtos
        </button>
      </article>
    </section>
  </section>
</template>

<style scoped>
h1 {
  margin: 0;
}

.favorites-products-section {
  min-height: 220px;
}
</style>
