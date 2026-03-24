<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  authState,
  signInWithGoogle,
  signOutUser,
} from '../services/authService'
import { isFirebaseConfigured } from '../firebase/config'
import { hasCompletedUserProfile } from '../services/marketplaceService'

const route = useRoute()
const router = useRouter()
const user = computed(() => authState.value)

async function handleLogin() {
  const loggedUser = await signInWithGoogle()
  const redirectTo = route.query.redirect || '/profile'

  if (!hasCompletedUserProfile(loggedUser)) {
    router.replace({
      name: 'profile-setup',
      query: { redirect: String(redirectTo) },
    })
    return
  }

  router.replace(String(redirectTo))
}

async function handleLogout() {
  await signOutUser()
  router.replace('/')
}
</script>

<template>
  <section class="auth-layout">
    <article class="card auth-card">
      <h1>Entrar no Marketplace</h1>
      <p class="muted" v-if="isFirebaseConfigured">
        Firebase ativo: login com Google via Auth real.
      </p>
      <p class="muted" v-else>
        Firebase nao configurado: login demo local habilitado para desenvolvimento.
      </p>

      <div v-if="!user" class="action-row">
        <button class="btn" type="button" @click="handleLogin">Entrar com Google</button>
      </div>

      <div v-else class="stack-sm">
        <p>Voce esta logado como <strong>{{ user.displayName }}</strong> ({{ user.email }})</p>
        <div class="action-row">
          <RouterLink to="/profile" class="btn">Ir para meu perfil</RouterLink>
          <button class="btn secondary" type="button" @click="handleLogout">Sair</button>
        </div>
      </div>
    </article>
  </section>
</template>
