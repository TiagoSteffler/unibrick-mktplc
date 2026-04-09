<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ProductCard from '../components/ProductCard.vue'
import { authState } from '../services/authService'
import { getFreeProducts, getHomeMessage, getRecentProducts } from '../services/marketplaceService'

const currentUser = computed(() => authState.value)
const freeProducts = ref([])
const recentProducts = ref([])
const homeMessage = ref(null)
const isMessageDismissed = ref(false)
const isLoading = ref(false)
const hasVisibleMessage = computed(() => Boolean(homeMessage.value) && !isMessageDismissed.value)

function closeMessageBanner() {
  isMessageDismissed.value = true
}

async function loadSections() {
  isLoading.value = true

  try {
    freeProducts.value = await getFreeProducts(8, { viewer: currentUser.value })
    recentProducts.value = await getRecentProducts(8, { viewer: currentUser.value })
    homeMessage.value = await getHomeMessage()
    isMessageDismissed.value = false
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadSections()
})

watch(currentUser, () => {
  loadSections()
})
</script>

<template>
  <section class="grid" style="gap: 18px">
    <article v-if="hasVisibleMessage" class="card home-message-modal">
      <div class="home-message-head">
        <div class="home-message-content">
          <p class="home-message-chip">Mensagem da administração</p>
          <h1>{{ homeMessage.title }}</h1>
          <p class="home-message-text">{{ homeMessage.message }}</p>
        </div>

        <button type="button" class="btn secondary home-message-close" @click="closeMessageBanner">
          Fechar
        </button>
      </div>
    </article>

    <section class="grid" style="gap: 12px">
      <h2>Anúncios Gratuitos</h2>
      <section class="loading-section home-products-section">
        <div v-if="isLoading" class="section-loading-overlay" aria-live="polite">
          <span class="spinner" aria-hidden="true"></span>
          <p>Carregando anúncios...</p>
        </div>

        <section class="grid products" v-if="freeProducts.length">
          <ProductCard v-for="product in freeProducts" :key="product.id" :product="product" />
        </section>
        <p v-else class="card muted">Nenhum anúncio gratuito no momento.</p>
      </section>
    </section>

    <section class="grid" style="gap: 12px">
      <h2>Recém Anunciados</h2>
      <section class="loading-section home-products-section">
        <div v-if="isLoading" class="section-loading-overlay" aria-live="polite">
          <span class="spinner" aria-hidden="true"></span>
          <p>Carregando anúncios...</p>
        </div>

        <section class="grid products" v-if="recentProducts.length">
          <ProductCard v-for="product in recentProducts" :key="product.id" :product="product" />
        </section>
        <p v-else class="card muted">Nenhum anúncio recente encontrado.</p>
      </section>
    </section>
  </section>
</template>

<style scoped>
h1,
h2 {
  margin: 0;
}

h1 {
  font-size: 24px;
}

h2 {
  font-size: 22px;
}

.home-message-modal {
  border-radius: 18px;
  border: 1px solid #bae6fd;
  background:
    radial-gradient(circle at 0% 0%, rgba(2, 132, 199, 0.08), transparent 40%),
    #f8fbff;
}

.home-message-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.home-message-content {
  display: grid;
  gap: 8px;
}

.home-message-chip {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #075985;
  font-weight: 700;
}

.home-message-text {
  margin: 0;
  color: #0f172a;
  line-height: 1.55;
  white-space: pre-line;
}

.home-message-close {
  min-width: 84px;
}

.home-products-section {
  min-height: 200px;
}

@media (max-width: 640px) {
  .home-message-head {
    flex-direction: column;
  }

  .home-message-close {
    width: 100%;
  }
}
</style>
