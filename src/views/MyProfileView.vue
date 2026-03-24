<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authState, signOutUser } from '../services/authService'
import { getMyProfile } from '../services/marketplaceService'

const router = useRouter()
const user = computed(() => authState.value)
const profile = ref(null)

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
</script>

<template>
  <section class="card" v-if="user">
    <h1>Meu Perfil</h1>
    <p><strong>Nome:</strong> {{ user.displayName }}</p>
    <p><strong>Email:</strong> {{ user.email }}</p>

    <template v-if="profile">
      <p><strong>Cidade:</strong> {{ profile.city }}</p>
      <p><strong>Descricao:</strong> {{ profile.about }}</p>
    </template>

    <div style="display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap">
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
