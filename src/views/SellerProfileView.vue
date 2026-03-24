<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ProductCard from '../components/ProductCard.vue'
import { getSellerById, getSellerProducts } from '../services/marketplaceService'

const route = useRoute()
const seller = ref(null)
const products = ref([])

async function loadSellerData() {
  seller.value = await getSellerById(route.params.sellerId)
  products.value = await getSellerProducts(route.params.sellerId)
}

onMounted(() => {
  loadSellerData()
})
</script>

<template>
  <section class="grid" style="gap: 16px">
    <article class="card" v-if="seller">
      <h1>{{ seller.name }}</h1>
      <p class="muted">Cidade: {{ seller.city }}</p>
      <p class="muted">Desde: {{ seller.joinedAt }}</p>
      <p style="margin-top: 8px">{{ seller.about }}</p>
    </article>

    <p v-else class="card muted">Vendedor nao encontrado.</p>

    <section class="grid products">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </section>
  </section>
</template>

<style scoped>
h1 {
  margin: 0;
}
</style>
