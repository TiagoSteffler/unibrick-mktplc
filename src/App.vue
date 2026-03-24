  <script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState } from './services/authService'
  import appLogo from './assets/blue-logo-1-CDTEx3Yb.png'

const router = useRouter()
const route = useRoute()
const headerSearch = ref('')
const isAuthenticated = computed(() => Boolean(authState.value))

watch(
  () => route.query.q,
  (value) => {
    headerSearch.value = typeof value === 'string' ? value : ''
  },
  { immediate: true },
)

function submitHeaderSearch() {
  const term = headerSearch.value.trim()
  router.push({
    name: 'search',
    query: term ? { q: term } : {},
  })
}

function goToProtected(path) {
  if (isAuthenticated.value) {
    router.push(path)
    return
  }

  router.push({
    name: 'login',
    query: { redirect: path },
  })
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-main">
        <RouterLink to="/" class="brand">
          <img :src="appLogo" alt="UniBrik" class="brand-logo" />
        </RouterLink>
        <form class="header-search" @submit.prevent="submitHeaderSearch">
          <input
            v-model="headerSearch"
            type="search"
            placeholder="Buscar produtos"
            aria-label="Buscar produtos"
          />

          <button type="submit" class="header-search-btn" aria-label="Pesquisar">
            <span class="search-icon" aria-hidden="true"></span>
          </button>
        </form>
      </div>

      <nav class="menu">
        <a href="/favorites" @click.prevent="goToProtected('/favorites')">Favoritos</a>
        <a href="/my/products" @click.prevent="goToProtected('/my/products')">Meus Anuncios</a>
        <RouterLink v-if="isAuthenticated" to="/profile">Meu Perfil</RouterLink>
        <RouterLink v-else to="/login">Login</RouterLink>
      </nav>
    </header>

    <main class="page-wrap">
      <RouterView />
    </main>
  </div>
</template>
