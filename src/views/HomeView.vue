<script setup>
import { onMounted, ref } from 'vue'
import ProductCard from '../components/ProductCard.vue'
import { getFreeProducts, getRecentProducts } from '../services/marketplaceService'

const freeProducts = ref([])
const recentProducts = ref([])

async function loadSections() {
  freeProducts.value = await getFreeProducts(8)
  recentProducts.value = await getRecentProducts(8)
}

onMounted(() => {
  loadSections()
})
</script>

<template>
  <section class="grid" style="gap: 18px">

    <section class="grid" style="gap: 12px">
      <h2>Anuncios Gratuitos</h2>
      <section class="grid products" v-if="freeProducts.length">
        <ProductCard v-for="product in freeProducts" :key="product.id" :product="product" />
      </section>
      <p v-else class="card muted">Nenhum anuncio gratuito no momento.</p>
    </section>

    <section class="grid" style="gap: 12px">
      <h2>Recem Anunciados</h2>
      <section class="grid products" v-if="recentProducts.length">
        <ProductCard v-for="product in recentProducts" :key="product.id" :product="product" />
      </section>
      <p v-else class="card muted">Nenhum anuncio recente encontrado.</p>
    </section>
  </section>
</template>

<style scoped>
h1,
h2 {
  margin: 0;
}

h1 {
  font-size: 28px;
}

h2 {
  font-size: 22px;
}
</style>
