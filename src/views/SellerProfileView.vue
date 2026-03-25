<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ProductCard from '../components/ProductCard.vue'
import { getSellerById, getSellerProducts } from '../services/marketplaceService'

const route = useRoute()
const seller = ref(null)
const products = ref([])

function formatDate(value) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value || 'Nao informado'
  }

  return parsed.toLocaleDateString('pt-BR')
}

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
      <div class="seller-profile-head">
        <img
          :src="seller.photoURL || 'https://placehold.co/220x220?text=Perfil'"
          alt="Foto de perfil do vendedor"
          class="seller-avatar"
        />

        <div class="seller-info">
          <h1>{{ seller.name }}</h1>
          <p><strong>Cidade natal:</strong> {{ seller.city || 'Nao informado' }}</p>
          <p><strong>Desde:</strong> {{ formatDate(seller.joinedAt) }}</p>
          <p><strong>Sobre mim:</strong> {{ seller.about || 'Nao Disponivel' }}</p>
        </div>
      </div>
    </article>

    <p v-else class="card muted">Vendedor nao encontrado.</p>

    <div v-if="seller" class="seller-products-head">
      <h2>Produtos deste vendedor</h2>
    </div>

    <section v-if="seller" class="grid products">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </section>
  </section>
</template>

<style scoped>
h1 {
  margin: 0;
}

h2 {
  margin: 0;
}

p {
  margin: 4px 0;
}

.seller-profile-head {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.seller-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #cbd5e1;
}

.seller-info {
  display: grid;
  gap: 4px;
}

.seller-products-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

@media (max-width: 640px) {
  .seller-profile-head {
    grid-template-columns: 1fr;
  }
}
</style>
