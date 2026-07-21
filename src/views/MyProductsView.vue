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

function getModerationStatusLabel(product) {
  const status = String(product?.moderationStatus || 'approved').toLowerCase()

  if (status === 'pending') {
    return 'Aguardando aprovação'
  }

  if (status === 'reported') {
    return 'Reportado para revisão'
  }

  if (status === 'rejected') {
    return 'Rejeitado pela administração'
  }

  return 'Publicado'
}

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
        <h1>Meus Produtos</h1>
        
      </div>
      <RouterLink class="btn" style="width: 100%; margin-top: 12px;" to="/product/new">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-icon lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        <text>Cadastrar Produto</text>
      </RouterLink>
    </div>

    <section class="loading-section my-products-grid-wrap">
      <div v-if="isLoading || isDeleting" class="section-loading-overlay" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <p v-if="isDeleting">Excluindo anúncio...</p>
        <p v-else>Carregando meus anúncios...</p>
      </div>

      <section class="grid products" v-if="products.length">
        <article class="grid" v-for="product in products" :key="product.id">
          <ProductCard :product="product" :showModerationLabel="true">
            <template #actions>
              <RouterLink class="btn secondary" :to="`/product/${product.id}/edit`">
                <svg style="width: 16px; height: 16px" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-icon lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                <text>Editar</text>
              </RouterLink>
              <button class="btn danger" type="button" @click="handleDelete(product.id)">
                <svg style="width: 16px; height: 16px" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <text>Excluir</text>
              </button>
            </template>
          </ProductCard>
        </article>
      </section>

      <p v-else class="card muted">Você ainda não cadastrou produtos.</p>

      <AppModal
        v-model="showDeleteModal"
        variant="danger"
        title="Excluir anúncio"
        message="Tem certeza que deseja excluir este anúncio? Esta ação não pode ser desfeita."
        confirm-text="Excluir anúncio"
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
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.product-status {
  margin: 0;
  margin-right: auto;
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
