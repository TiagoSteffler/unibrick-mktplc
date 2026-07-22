<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState, isAdminSession } from './services/authService'
import { getUserProfile } from './services/marketplaceService'
import appLogo from './assets/blue-logo-1-CDTEx3Yb.png'
import InstallPrompt from './components/InstallPrompt.vue'

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
    <InstallPrompt />
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
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-icon lucide-message-square"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/></svg>

          <span class="menu-label">Chat</span>
        </a>

        <a href="/favorites" class="menu-item" @click.prevent="goToProtected('/favorites')" aria-label="Favoritos">
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 21s-6.7-4.35-9.33-7.97A5.75 5.75 0 0 1 12 5.5a5.75 5.75 0 0 1 9.33 7.53C18.7 16.65 12 21 12 21z"></path>
          </svg>
          <span class="menu-label">Favoritos</span>
        </a>

        <a href="/my/products" class="menu-item" @click.prevent="goToProtected('/my/products')" aria-label="Meus anúncios">
          <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/>
            <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/>
            <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>
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
        <svg class="menu-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/>
          <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/>
          <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>
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
