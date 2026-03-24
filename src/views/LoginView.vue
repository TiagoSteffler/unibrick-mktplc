<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  authState,
  signInWithGoogle,
  signOutUser,
} from '../services/authService'
import { isFirebaseConfigured } from '../firebase/config'

const route = useRoute()
const router = useRouter()
const user = computed(() => authState.value)

async function handleLogin() {
  await signInWithGoogle()
  const redirectTo = route.query.redirect || '/profile'
  router.replace(String(redirectTo))
}

async function handleLogout() {
  await signOutUser()
  router.replace('/')
}
</script>

<template>
  <section class="card">
    <h1>Entrar no Marketplace</h1>
    <p class="muted" v-if="isFirebaseConfigured">
      Firebase ativo: login com Google via Auth real.
    </p>
    <p class="muted" v-else>
      Firebase nao configurado: login demo local habilitado para desenvolvimento.
    </p>

    <div v-if="!user" style="margin-top: 14px">
      <button class="btn" type="button" @click="handleLogin">Entrar com Google</button>
    </div>

    <div v-else class="grid" style="margin-top: 14px; gap: 8px">
      <p>Voce esta logado como <strong>{{ user.displayName }}</strong> ({{ user.email }})</p>
      <div style="display: flex; gap: 8px; flex-wrap: wrap">
        <RouterLink to="/profile" class="btn">Ir para meu perfil</RouterLink>
        <button class="btn secondary" type="button" @click="handleLogout">Sair</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
h1 {
  margin: 0;
}
</style>
