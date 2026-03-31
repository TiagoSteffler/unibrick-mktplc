<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DomainRestrictionModal from '../components/DomainRestrictionModal.vue'
import {
  AUTH_ERROR_KIND_DOMAIN_RESTRICTED,
  allowedLoginDomainsText,
  authError,
  authErrorKind,
  authState,
  blockedLoginDomain,
  clearAuthError,
  isLoginDomainRestrictionEnabled,
  signInWithGoogle,
  signOutUser,
} from '../services/authService'
import { isFirebaseConfigured } from '../firebase/config'
import { hasCompletedUserProfile } from '../services/marketplaceService'

const route = useRoute()
const router = useRouter()
const user = computed(() => authState.value)
const isSigningIn = ref(false)
const loginError = computed(() => authError.value)
const isDomainRestrictionError = computed(
  () => authErrorKind.value === AUTH_ERROR_KIND_DOMAIN_RESTRICTED,
)
const showDomainRestrictionModal = computed(
  () => Boolean(loginError.value) && isDomainRestrictionError.value,
)

function closeDomainRestrictionModal() {
  clearAuthError()
}

function handleDomainRestrictionModalModelUpdate(nextValue) {
  if (!nextValue) {
    closeDomainRestrictionModal()
  }
}

function getRedirectTarget() {
  const redirectTo = String(route.query.redirect || '/profile')

  if (redirectTo.startsWith('/login')) {
    return '/profile'
  }

  return redirectTo
}

async function redirectAfterLogin(loggedUser) {
  const redirectTo = getRedirectTarget()

  if (!hasCompletedUserProfile(loggedUser)) {
    await router.replace({
      name: 'profile-setup',
      query: { redirect: String(redirectTo) },
    })
    return
  }

  await router.replace(redirectTo)
}

watch(
  user,
  async (loggedUser) => {
    if (!loggedUser || route.name !== 'login') {
      return
    }

    clearAuthError()
    await redirectAfterLogin(loggedUser)
  },
  { immediate: true },
)

async function handleLogin() {
  if (isSigningIn.value) {
    return
  }

  isSigningIn.value = true
  clearAuthError()

  try {
    await signInWithGoogle()
  } finally {
    isSigningIn.value = false
  }
}

async function handleLogout() {
  clearAuthError()
  await signOutUser()
  router.replace('/')
}
</script>

<template>
  <section class="auth-layout">
    <article class="card auth-card">
      <h1>Entrar no Marketplace</h1>
      <p class="muted" v-if="isFirebaseConfigured">
        Firebase ativo: login com Google via popup.
      </p>
      <p class="muted" v-if="isFirebaseConfigured && isLoginDomainRestrictionEnabled">
        Login restrito para emails de: {{ allowedLoginDomainsText }}.
      </p>
      <p class="muted" v-if="!isFirebaseConfigured">
        Firebase nao configurado: login demo local habilitado para desenvolvimento.
      </p>

      <div v-if="!user" class="action-row">
        <button
          class="btn"
          :class="{ disabled: isSigningIn }"
          type="button"
          :disabled="isSigningIn"
          @click="handleLogin"
        >
          {{ isSigningIn ? 'Abrindo popup do Google...' : 'Entrar com Google' }}
        </button>
      </div>
      <div v-else class="stack-sm">
        <p>Voce esta logado como <strong>{{ user.displayName }}</strong> ({{ user.email }})</p>
        <div class="action-row">
          <RouterLink to="/profile" class="btn">Ir para meu perfil</RouterLink>
          <button class="btn secondary" type="button" @click="handleLogout">Sair</button>
        </div>
      </div>

      <p v-if="loginError && !isDomainRestrictionError" class="status-message error">{{ loginError }}</p>
    </article>

    <DomainRestrictionModal
      :model-value="showDomainRestrictionModal"
      :allowed-domains-text="allowedLoginDomainsText"
      :blocked-domain="blockedLoginDomain"
      @update:modelValue="handleDomainRestrictionModalModelUpdate"
      @close="closeDomainRestrictionModal"
    />
  </section>
</template>
