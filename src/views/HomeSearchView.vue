<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ProductCard from '../components/ProductCard.vue'
import {
  getAvailableCategories,
  searchProducts,
} from '../services/marketplaceService'

const route = useRoute()

const filters = reactive({
  category: '',
  minPrice: '',
  maxPrice: '',
  condition: '',
  sortBy: 'recent',
})

const products = ref([])
const categories = ref([])

async function loadProducts() {
  const queryTerm = typeof route.query.q === 'string' ? route.query.q.trim() : ''
  products.value = await searchProducts({
    ...filters,
    query: queryTerm,
  })
}

async function initialize() {
  categories.value = await getAvailableCategories()
  await loadProducts()
}

function resetFilters() {
  filters.category = ''
  filters.minPrice = ''
  filters.maxPrice = ''
  filters.condition = ''
  filters.sortBy = 'recent'
  loadProducts()
}

onMounted(() => {
  initialize()
})

watch(
  () => route.query.q,
  () => {
    loadProducts()
  },
)
</script>

<template>
  <section class="search-layout">
    <aside class="card filters-panel">
      <h1>Pesquisa</h1>
      <p class="muted">Filtre por preco, categoria e outros criterios.</p>

      <form class="grid" style="margin-top: 14px" @submit.prevent="loadProducts">
        <select v-model="filters.category">
          <option value="">Todas categorias</option>
          <option v-for="category in categories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>

        <div class="grid" style="grid-template-columns: 1fr 1fr">
          <input v-model="filters.minPrice" type="number" min="0" step="0.01" placeholder="Preco min" />
          <input v-model="filters.maxPrice" type="number" min="0" step="0.01" placeholder="Preco max" />
        </div>

        <select v-model="filters.condition">
          <option value="">Estado (todos)</option>
          <option value="novo">Novo</option>
          <option value="usado">Usado</option>
        </select>

        <select v-model="filters.sortBy">
          <option value="recent">Mais recentes</option>
          <option value="priceAsc">Menor preco</option>
          <option value="priceDesc">Maior preco</option>
        </select>

        <div style="display: flex; gap: 8px">
          <button class="btn" type="submit">Aplicar</button>
          <button class="btn secondary" type="button" @click="resetFilters">Limpar</button>
        </div>
      </form>
    </aside>

    <section class="grid search-results">
      <article class="card">
        <h2>Resultados</h2>
        <p class="muted" v-if="route.query.q">
          Busca atual: "{{ route.query.q }}"
        </p>
        <p class="muted">{{ products.length }} produto(s) encontrado(s).</p>
      </article>

      <section class="grid products" v-if="products.length">
        <ProductCard v-for="product in products" :key="product.id" :product="product" />
      </section>

      <p v-else class="card muted">Nenhum produto encontrado para os filtros atuais.</p>
    </section>
  </section>
</template>

<style scoped>
h1 {
  margin: 0;
  font-size: 28px;
}

h2 {
  margin: 0;
}

.search-layout {
  display: grid;
  gap: 16px;
  grid-template-columns: 300px minmax(0, 1fr);
  align-items: start;
}

.filters-panel {
  position: sticky;
  top: calc(var(--topbar-height) + 34px);
  width: 300px;
  max-height: calc(100vh - var(--topbar-height) - 52px);
  overflow: hidden;
}

.search-results {
  min-width: 0;
}

@media (max-width: 1100px) {
  .search-layout {
    grid-template-columns: 1fr;
  }

  .filters-panel {
    position: static;
    width: auto;
    max-height: none;
    overflow: visible;
  }

  .search-results {
    margin-left: 0;
  }
}
</style>
