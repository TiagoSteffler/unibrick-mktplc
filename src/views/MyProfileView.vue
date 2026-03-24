<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authState, signOutUser } from '../services/authService'
import { getMyProfile, hasCompletedUserProfile } from '../services/marketplaceService'

const router = useRouter()
const user = computed(() => authState.value)
const profile = ref(null)
const hasConfiguredProfile = computed(() => hasCompletedUserProfile(user.value))

async function loadProfile() {
  profile.value = await getMyProfile(user.value)
}

async function handleLogout() {
  await signOutUser()
  router.replace('/')
}

onMounted(() => {
  loadProfile()
})

watch(user, () => {
  loadProfile()
})
</script>

<template>
  <section class="card" v-if="user">
    <h1>Meu Perfil</h1>
    <p><strong>Nome:</strong> {{ profile?.fullName || user.displayName }}</p>
    <p><strong>Email:</strong> {{ user.email }}</p>

    <template v-if="hasConfiguredProfile && profile">
      <p><strong>Sexo:</strong> {{ profile.gender }}</p>
      <p><strong>Bairro:</strong> {{ profile.neighborhood }}</p>
    </template>

    <p v-else class="muted" style="margin-top: 8px">
      Complete seu cadastro para liberar edicao de perfil e uso completo da conta.
    </p>

    <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap">
      <RouterLink v-if="hasConfiguredProfile" to="/profile/edit" class="btn secondary">
        Editar perfil
      </RouterLink>
      <RouterLink v-else to="/profile/setup" class="btn secondary">Completar cadastro</RouterLink>
      <RouterLink to="/my/products" class="btn">Meus anuncios</RouterLink>
      <RouterLink to="/favorites" class="btn secondary">Meus favoritos</RouterLink>
      <button class="btn secondary" type="button" @click="handleLogout">Sair</button>
    </div>
  </section>
</template>

<style scoped>
h1 {
  margin: 0 0 10px;
}

p {
  margin: 4px 0;
}
</style>
