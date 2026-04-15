<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState, isAdminSession } from './services/authService'
import { getUserProfile } from './services/marketplaceService'
import appLogo from './assets/blue-logo-1-CDTEx3Yb.png'

const router = useRouter()
const route = useRoute()
const headerSearch = ref('')
const isAuthenticated = computed(() => Boolean(authState.value))
const isAdmin = computed(() => Boolean(isAuthenticated.value && isAdminSession.value))
const profilePhoto = computed(() => {
  // Reavalia em mudancas de rota para refletir perfil sincronizado em background.
  void route.fullPath

  const currentUser = authState.value

  if (!currentUser) {
    return ''
  }

  const profile = getUserProfile(currentUser)
  return profile?.photoURL || ''
})
const hideNavigationChrome = computed(() => {
  return route.name === 'profile-setup' || route.name === 'login'
})

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
    <header v-if="!hideNavigationChrome" class="topbar">
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
        <a href="/chat" class="menu-item" @click.prevent="goToProtected('/chat')" aria-label="Chat">
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3v-5.5A8.5 8.5 0 1 1 21 11.5z"></path>
          </svg>
          <span class="menu-label">Chat</span>
        </a>

        <a href="/favorites" class="menu-item" @click.prevent="goToProtected('/favorites')" aria-label="Favoritos">
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 21s-6.7-4.35-9.33-7.97A5.75 5.75 0 0 1 12 5.5a5.75 5.75 0 0 1 9.33 7.53C18.7 16.65 12 21 12 21z"></path>
          </svg>
          <span class="menu-label">Favoritos</span>
        </a>

        <a
          href="/my/products"
          class="menu-item"
          @click.prevent="goToProtected('/my/products')"
          aria-label="Meus anúncios"
        >
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7h18"></path>
            <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"></path>
            <path d="M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13"></path>
          </svg>
          <span class="menu-label">Meus Anúncios</span>
        </a>

        <RouterLink v-if="isAdmin" to="/admin" class="menu-item" aria-label="Painel admin">
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9l-5 4.87L18.18 21 12 17.77 5.82 21 7 13.87 2 9l6.91-.74L12 2z"></path>
          </svg>
          <span class="menu-label">Admin</span>
        </RouterLink>

        <RouterLink v-if="isAuthenticated" to="/profile" class="profile-link menu-item" aria-label="Meu perfil">
          <img
            v-if="profilePhoto"
            :src="profilePhoto"
            alt="Foto de perfil"
            class="profile-avatar"
          />
          <svg v-else class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span class="menu-label">Meu Perfil</span>
        </RouterLink>

        <RouterLink v-else to="/login" class="menu-item" aria-label="Login">
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span class="menu-label">Login</span>
        </RouterLink>
      </nav>
    </header>

    <nav v-if="!hideNavigationChrome" class="mobile-bottom-menu" aria-label="Navegacao mobile">
      <a href="/chat" class="menu-item" @click.prevent="goToProtected('/chat')" aria-label="Chat">
        <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3v-5.5A8.5 8.5 0 1 1 21 11.5z"></path>
        </svg>
      </a>

      <a href="/favorites" class="menu-item" @click.prevent="goToProtected('/favorites')" aria-label="Favoritos">
        <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 21s-6.7-4.35-9.33-7.97A5.75 5.75 0 0 1 12 5.5a5.75 5.75 0 0 1 9.33 7.53C18.7 16.65 12 21 12 21z"></path>
        </svg>
      </a>

      <a
        href="/my/products"
        class="menu-item"
        @click.prevent="goToProtected('/my/products')"
        aria-label="Meus anúncios"
      >
        <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7h18"></path>
          <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"></path>
          <path d="M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13"></path>
        </svg>
      </a>

      <RouterLink v-if="isAdmin" to="/admin" class="menu-item" aria-label="Painel admin">
        <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2l3.09 6.26L22 9l-5 4.87L18.18 21 12 17.77 5.82 21 7 13.87 2 9l6.91-.74L12 2z"></path>
        </svg>
      </RouterLink>

      <RouterLink v-if="isAuthenticated" to="/profile" class="profile-link menu-item" aria-label="Meu perfil">
        <img
          v-if="profilePhoto"
          :src="profilePhoto"
          alt="Foto de perfil"
          class="profile-avatar"
        />
        <svg v-else class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </RouterLink>

      <RouterLink v-else to="/login" class="menu-item" aria-label="Login">
        <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </RouterLink>
    </nav>

    <main class="page-wrap" :class="{ 'page-wrap-onboarding': hideNavigationChrome }">
      <RouterView />
    </main>
  </div>
</template>
