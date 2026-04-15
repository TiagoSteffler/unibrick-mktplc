<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DomainRestrictionModal from '../components/DomainRestrictionModal.vue'
import appLogo from '../assets/blue-logo-1-CDTEx3Yb.png'
import {
  AUTH_ERROR_KIND_DOMAIN_RESTRICTED,
  allowedLoginDomainsText,
  authError,
  authErrorKind,
  authState,
  blockedLoginDomain,
  clearAuthError,
  signInWithGoogle,
} from '../services/authService'
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

  if (!(await hasCompletedUserProfile(loggedUser))) {
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
</script>

<template>
  <section class="auth-layout">
    <article class="login-modal" aria-label="Entrar na conta">
      <img :src="appLogo" alt="UniBrik" class="login-logo" />
      <hr class="login-divider" />
      <h1 class="login-title">Entre em sua conta</h1>
      <h4 class="login-subtitle">Destinado a alunos e servidores da UFSM.<br>Projeto particular sem fins lucrativos.</h4>
      <h4 class="login-subtitle">Entre com sua conta Institucional:</h4>

      <button
        class="google-login-btn"
        :class="{ disabled: isSigningIn }"
        type="button"
        :disabled="isSigningIn"
        @click="handleLogin"
      >
        <span class="google-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6.1-2.8-6.1-6.2S8.7 5.6 12 5.6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2 12 2 6.9 2 2.8 6.2 2.8 11.4S6.9 20.8 12 20.8c6.9 0 9.2-4.8 9.2-7.3 0-.5 0-.9-.1-1.2H12z"/>
            <path fill="#34A853" d="M2.8 6.8l3.2 2.4C6.8 7 9.1 5.6 12 5.6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.1 14.6 2 12 2 8.4 2 5.4 4 3.8 6.8z"/>
            <path fill="#FBBC05" d="M12 20.8c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.6-1.9 1-3.4 1-2.9 0-5.3-1.9-6.2-4.6l-3.3 2.5c1.6 3.4 5 5.8 9.5 5.8z"/>
            <path fill="#4285F4" d="M21.2 13.5c0-.7-.1-1.2-.2-1.8H12v3.9h5.5c-.3 1.5-1.2 2.7-2.5 3.5l2.9 2.4c1.7-1.6 3.3-4.1 3.3-8z"/>
          </svg>
        </span>
        <span>{{ isSigningIn ? 'Redirecionando...' : 'Entrar com Google' }}</span>
        <span class="google-caret" aria-hidden="true">▾</span>
      </button>
      <hr class="login-divider" />

      <h4 class="login-subtitle">Problemas em realizar o login?<br>Entre em contato pelo email <a style="color:#093350;" href="mailto:unibrikmarketplace@gmail.com">unibrikmarketplace@gmail.com</a></h4>


      <p v-if="loginError && !isDomainRestrictionError" class="login-error">{{ loginError }}</p>
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

<style scoped>
.login-modal {
  width: min(420px, 100%);
  height: min(600px, 100%);
  border-radius: 24px;
  border: 1px solid #dbe4ee;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
  padding: 34px 26px 26px;
  display: grid;
  gap: 18px;
  justify-items: center;
}

.login-logo {
  width: min(210px, 78%);
  height: auto;
  display: block;
}

.login-divider {
  width: 80%;
  border: 0;
  border-top: 1px solid #dbe4ee;
  margin: 0;
}

.login-title {
  margin: 0;
  text-align: center;
  font-size: 28px;
  line-height: 3;
  color: #0f172a;
  font-weight: 500;
}

.login-subtitle {
  margin: 0;
  text-align: center;
  font-size: 15px;
  line-height: 1.4;
  color: #64748b;
  font-weight: 500;
}

.google-login-btn {
  width: 90%;
  border: 1px solid #c7d2e0;
  border-radius: 25px;
  background: #ffffff;
  color: #0f172a;
  height: 50px;
  padding: 10px 14px;
  cursor: pointer;
  display: grid;
  grid-template-columns: 22px 1fr auto;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  font-weight: 600;
  margin: 12px 0;
  transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.18s ease;
}

.google-login-btn:hover {
  border-color: #8ca3bf;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.google-login-btn:disabled,
.google-login-btn.disabled {
  cursor: not-allowed;
  opacity: 0.72;
  transform: none;
}

.google-icon {
  width: 22px;
  height: 22px;
  display: inline-grid;
  place-items: center;
}

.google-icon svg {
  width: 22px;
  height: 22px;
  display: block;
}

.google-caret {
  color: #64748b;
  font-size: 14px;
}

.login-error {
  margin: 0;
  width: 100%;
  text-align: center;
  color: #b91c1c;
  font-size: 14px;
  line-height: 1.4;
}

@media (max-width: 480px) {
  .login-modal {
    border-radius: 20px;
    padding: 28px 18px 20px;
    gap: 16px;
  }

  .login-title {
    font-size: 24px;
  }
}
</style>
