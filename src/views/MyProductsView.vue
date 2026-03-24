<script setup>
import { computed, onMounted, ref } from 'vue'
import ProductCard from '../components/ProductCard.vue'
import { authState } from '../services/authService'
import { deleteProduct, getMyProducts } from '../services/marketplaceService'

const user = computed(() => authState.value)
const products = ref([])

async function loadMyProducts() {
  products.value = await getMyProducts(user.value)
}

async function handleDelete(productId) {
  const confirmed = window.confirm('Deseja mesmo excluir este produto?')

  if (!confirmed) {
    return
  }

  await deleteProduct(productId, user.value)
  await loadMyProducts()
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

@media (max-width: 700px) {
  .header-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
