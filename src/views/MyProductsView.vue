<script setup>
import { computed, onMounted, ref } from 'vue'
import AppModal from '../components/AppModal.vue'
import ProductCard from '../components/ProductCard.vue'
import { authState } from '../services/authService'
import { deleteProduct, getMyProducts } from '../services/marketplaceService'

const user = computed(() => authState.value)
const products = ref([])
const isLoading = ref(false)
const isDeleting = ref(false)
const showDeleteModal = ref(false)
const productIdToDelete = ref('')

async function loadMyProducts() {
  isLoading.value = true

  try {
    products.value = await getMyProducts(user.value)
  } finally {
    isLoading.value = false
  }
}

async function handleDelete(productId) {
  if (isDeleting.value) {
    return
  }

  productIdToDelete.value = String(productId || '')
  showDeleteModal.value = true
}

async function confirmDeleteProduct() {
  if (!productIdToDelete.value) {
    return
  }

  showDeleteModal.value = false

  isDeleting.value = true

  try {
    await deleteProduct(productIdToDelete.value, user.value)
    await loadMyProducts()
  } finally {
    isDeleting.value = false
    productIdToDelete.value = ''
  }
}

onMounted(() => {
  loadMyProducts()
})
</script>

<template>
  <section class="grid" style="gap: 14px">
    <div class="card">
      <div class="header-row">
        <h1>Meus Produtos Cadastrados</h1>
        <RouterLink class="btn" to="/product/new">Cadastrar Produto</RouterLink>
      </div>
      <p class="muted">Lista de anuncios vinculados a sua conta.</p>
    </div>

    <section class="loading-section my-products-grid-wrap">
      <div v-if="isLoading || isDeleting" class="section-loading-overlay" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <p v-if="isDeleting">Excluindo anuncio...</p>
        <p v-else>Carregando meus anuncios...</p>
      </div>

      <section class="grid products" v-if="products.length">
        <article class="grid" style="gap: 8px" v-for="product in products" :key="product.id">
          <ProductCard :product="product" />
          <div class="card actions-row">
            <RouterLink class="btn secondary" :to="`/product/${product.id}/edit`">Editar</RouterLink>
            <button class="btn danger" type="button" @click="handleDelete(product.id)">Excluir</button>
          </div>
        </article>
      </section>

      <p v-else class="card muted">Voce ainda nao cadastrou produtos.</p>

      <AppModal
        v-model="showDeleteModal"
        variant="danger"
        title="Excluir anuncio"
        message="Tem certeza que deseja excluir este anuncio? Esta acao nao pode ser desfeita."
        confirm-text="Excluir anuncio"
        cancel-text="Cancelar"
        @confirm="confirmDeleteProduct"
      />
    </section>
  </section>
</template>

<style scoped>
h1 {
  margin: 0;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.actions-row {
  padding: 10px 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn.danger {
  background: #b91c1c;
}

.my-products-grid-wrap {
  min-height: 220px;
}

@media (max-width: 700px) {
  .header-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
