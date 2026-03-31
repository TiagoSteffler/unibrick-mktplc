<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ProductCard from '../components/ProductCard.vue'
import { getSellerById, getSellerProducts } from '../services/marketplaceService'

const route = useRoute()
const seller = ref(null)
const products = ref([])
const isLoading = ref(false)

function formatDate(value) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value || 'Nao informado'
  }

  return parsed.toLocaleDateString('pt-BR')
}

async function loadSellerData() {
  isLoading.value = true

  try {
    seller.value = await getSellerById(route.params.sellerId)
    products.value = await getSellerProducts(route.params.sellerId)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadSellerData()
})
</script>

<template>
  <section class="grid loading-section" style="gap: 16px">
    <div v-if="isLoading" class="section-loading-overlay" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <p>Carregando dados do vendedor...</p>
    </div>

    <article class="card" v-if="seller">
      <div class="seller-profile-head">
        <div class="seller-avatar-container">
          <img
            v-if="seller?.photoURL"
            :src="seller.photoURL"
            alt="Foto de perfil do vendedor"
            class="seller-avatar"
          />
          <div v-else class="seller-avatar-default">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        </div>

        <div class="seller-info">
          <h1>{{ seller.name }}</h1>
          <p><strong>Cidade natal:</strong> {{ seller.city || 'Nao informado' }}</p>
          <p><strong>Curso/Ocupacao:</strong> {{ seller.universityRole || 'Nao informado' }}</p>
          <p><strong>Desde:</strong> {{ formatDate(seller.joinedAt) }}</p>
          <p class="seller-about-row">
            <strong>Sobre mim:</strong>
            <span class="about-text">{{ seller.about || 'Nao Disponivel' }}</span>
          </p>
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
  padding: 16px 30px;
  display: grid;
  grid-template-columns: 1fr minmax(0, 4fr);
  gap: 30px;
  align-items: start;
  height:auto;
}

.seller-avatar-container {
  display: flex;
  align-items: center;
  justify-content: center;
    height: 100%;
  aspect-ratio: 1;
}

.seller-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #cbd5e1;
}

.seller-avatar-default {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  background: #f1f5f9;
  color: #94a3b8;
}

.seller-avatar-default svg {
  width: 60px;
  height: 60px;
}

.seller-info {
  display: grid;
  gap: 4px;
}

.seller-about-row {
  display: grid;
  gap: 2px;
}

.about-text {
  white-space: pre-line;
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
