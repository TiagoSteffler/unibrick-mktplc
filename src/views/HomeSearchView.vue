<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ProductCard from '../components/ProductCard.vue'
import { authState } from '../services/authService'
import {
  getAvailableCategories,
  searchProducts,
} from '../services/marketplaceService'

const route = useRoute()
const currentUser = computed(() => authState.value)

const filters = reactive({
  category: '',
  minPrice: '',
  maxPrice: '',
  condition: '',
  sortBy: 'recent',
})

const priceDisplay = reactive({
  minPrice: '',
  maxPrice: '',
})

const MAX_PRICE_CENTS = 999999

const products = ref([])
const categories = ref([])
const isLoading = ref(false)
const areFiltersOpen = ref(false)

function formatCurrencyValue(value) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function clampPriceFromInput(rawValue, fieldName) {
  const onlyDigits = String(rawValue || '').replace(/\D/g, '').slice(0, 6)

  if (!onlyDigits) {
    priceDisplay[fieldName] = ''
    filters[fieldName] = ''
    return
  }

  const cents = Math.min(Number.parseInt(onlyDigits, 10) || 0, MAX_PRICE_CENTS)
  priceDisplay[fieldName] = formatCurrencyValue(cents / 100)
  filters[fieldName] = (cents / 100).toFixed(2)
}

function formatPriceInput(event, fieldName) {
  clampPriceFromInput(event.target.value, fieldName)
  event.target.value = priceDisplay[fieldName]
}

function handlePriceKeydown(event, fieldName) {
  if (event.key !== 'Backspace' && event.key !== 'Delete') {
    return
  }

  const digits = String(priceDisplay[fieldName] || '').replace(/\D/g, '')

  if (!digits) {
    return
  }

  const nextDigits = digits.slice(0, -1)

  if (!nextDigits) {
    priceDisplay[fieldName] = ''
    filters[fieldName] = ''
    event.preventDefault()
    return
  }

  clampPriceFromInput(nextDigits, fieldName)
  event.preventDefault()
}

function handlePriceFocus(event) {
  const target = event.target

  setTimeout(() => {
    target.selectionStart = target.selectionEnd = target.value.length
  }, 0)
}

async function loadProducts() {
  isLoading.value = true

  try {
    const queryTerm = typeof route.query.q === 'string' ? route.query.q.trim() : ''
    products.value = await searchProducts({
      ...filters,
      query: queryTerm,
    }, {
      viewer: currentUser.value,
    })
  } finally {
    isLoading.value = false
  }
}

async function initialize() {
  isLoading.value = true

  try {
    categories.value = await getAvailableCategories({ viewer: currentUser.value })
    await loadProducts()
  } finally {
    isLoading.value = false
  }
}

function resetFilters() {
  filters.category = ''
  filters.minPrice = ''
  filters.maxPrice = ''
  priceDisplay.minPrice = ''
  priceDisplay.maxPrice = ''
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

watch(currentUser, () => {
  initialize()
})
</script>

<template>
  <section class="search-layout">
    <aside class="card filters-panel">
      <h1>Pesquisa</h1>
      <p class="muted">Filtre por preço, categoria e outros critérios.</p>

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
        <input
          v-model="priceDisplay.minPrice"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="R$ 0,00"
          class="valueinput"
          @input="formatPriceInput($event, 'minPrice')"
          @keydown="handlePriceKeydown($event, 'minPrice')"
          @focus="handlePriceFocus"
          @click="handlePriceFocus"
        />
        </div>
        <div>
        <label class="filter-label">Preço máx.</label>
        <input
          v-model="priceDisplay.maxPrice"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="R$ 0,00"
          class="valueinput"
          @input="formatPriceInput($event, 'maxPrice')"
          @keydown="handlePriceKeydown($event, 'maxPrice')"
          @focus="handlePriceFocus"
          @click="handlePriceFocus"
        />
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
