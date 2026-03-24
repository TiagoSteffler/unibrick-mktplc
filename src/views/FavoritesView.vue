<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ProductCard from '../components/ProductCard.vue'
import { authState } from '../services/authService'
import { getFavoriteProducts } from '../services/marketplaceService'

const router = useRouter()
const user = computed(() => authState.value)
const favorites = ref([])

async function loadFavorites() {
  favorites.value = await getFavoriteProducts(user.value)
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
</template>

<style scoped>
h1 {
  margin: 0;
}
</style>
