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
const isLoading = ref(false)
const areFiltersOpen = ref(false)

async function loadProducts() {
  isLoading.value = true

  try {
    const queryTerm = typeof route.query.q === 'string' ? route.query.q.trim() : ''
    products.value = await searchProducts({
      ...filters,
      query: queryTerm,
    })
  } finally {
    isLoading.value = false
  }
}

async function initialize() {
  isLoading.value = true

  try {
    categories.value = await getAvailableCategories()
    await loadProducts()
  } finally {
    isLoading.value = false
  }
}

function resetFilters() {
  filters.category = ''
  filters.minPrice = ''
  filters.maxPrice = ''
  filters.condition = ''
  filters.sortBy = 'recent'
  loadProducts()
}

function toggleFilters() {
  areFiltersOpen.value = !areFiltersOpen.value
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

      <button
        type="button"
        class="btn secondary filters-toggle"
        :aria-expanded="areFiltersOpen"
        @click="toggleFilters"
      >
        {{ areFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros' }}
      </button>

      <form
        class="grid filters-form"
        :class="{ collapsed: !areFiltersOpen }"
        style="margin-top: 14px"
        @submit.prevent="loadProducts"
      >
      <div>
        <label class="filter-label">Categoria</label>
        <select v-model="filters.category" class="dropdown">
        <option value="">Todas categorias</option>
        <option v-for="category in categories" :key="category" :value="category">
          {{ category }}
        </option>
        </select>
      </div>

      <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 8px">
        <div>
        <label class="filter-label">Preço mín.</label>
        <input v-model="filters.minPrice" type="number" min="0" step="0.01" placeholder="Preço min" class="valueinput" />
        </div>
        <div>
        <label class="filter-label">Preço máx.</label>
        <input v-model="filters.maxPrice" type="number" min="0" step="0.01" placeholder="Preço max" class="valueinput" />
        </div>
      </div>

      <div>
        <label class="filter-label">Estado</label>
        <select v-model="filters.condition" class="dropdown">
        <option value="">Estado (todos)</option>
        <option value="novo">Novo</option>
        <option value="usado">Usado</option>
        </select>
      </div>

      <div>
        <label class="filter-label">Ordenar por</label>
        <select v-model="filters.sortBy" class="dropdown">
        <option value="recent">Mais recentes</option>
        <option value="priceAsc">Menor preço</option>
        <option value="priceDesc">Maior preço</option>
        </select>
      </div>

      <div style="display: flex; gap: 8px; padding-top: 8px">
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

      <section class="loading-section search-products-section">
        <div v-if="isLoading" class="section-loading-overlay" aria-live="polite">
          <span class="spinner" aria-hidden="true"></span>
          <p>Carregando resultados...</p>
        </div>

        <section class="grid products" v-if="products.length">
          <ProductCard v-for="product in products" :key="product.id" :product="product" />
        </section>

        <p v-else class="card muted">Nenhum produto encontrado para os filtros atuais.</p>
      </section>
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

.search-products-section {
  min-height: 220px;
}

.filters-toggle {
  display: none;
}

.filters-form.collapsed {
  max-height: none;
  opacity: 1;
  pointer-events: auto;
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

  .filters-toggle {
    display: inline-flex;
    margin-top: 12px;
  }

  .filters-form {
    overflow: hidden;
    transition: max-height 0.2s ease, opacity 0.2s ease;
    max-height: 900px;
    opacity: 1;
  }

  .filters-form.collapsed {
    max-height: 0;
    opacity: 0;
    pointer-events: none;
    margin-top: 0 !important;
  }
}
</style>
