<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authState, signOutUser } from '../services/authService'
import ProductCard from '../components/ProductCard.vue'
import { getMyProducts, getMyProfile, hasCompletedUserProfile } from '../services/marketplaceService'

const router = useRouter()
const user = computed(() => authState.value)
const profile = ref(null)
const myProducts = ref([])
const hasConfiguredProfile = computed(() => hasCompletedUserProfile(user.value))
const highlightedMyProducts = computed(() => myProducts.value.slice(0, 3))

function formatDate(value) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value || 'Nao informado'
  }

  return parsed.toLocaleDateString('pt-BR')
}

async function loadProfile() {
  if (!user.value) {
    profile.value = null
    myProducts.value = []
    return
  }

  profile.value = await getMyProfile(user.value)
  myProducts.value = await getMyProducts(user.value)
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
  <section class="grid" style="gap: 16px" v-if="user">
    <article class="card">
      <div class="my-profile-head">
        <img
          :src="(profile && profile.photoURL) || user.photoURL || 'https://placehold.co/220x220?text=Perfil'"
          alt="Minha foto de perfil"
          class="my-avatar"
        />

        <div class="my-info">
          <h1>{{ profile?.fullName || user.displayName || 'Meu perfil' }}</h1>
          <p><strong>Cidade natal:</strong> {{ profile?.city || 'Nao informado' }}</p>
          <p><strong>Desde:</strong> {{ formatDate(profile?.joinedAt) }}</p>
          <p><strong>Sobre mim:</strong> {{ profile?.about || 'Nao Disponivel' }}</p>

          <p v-if="!hasConfiguredProfile" class="muted" style="margin-top: 6px">
            Complete seu cadastro para liberar edicao de perfil e uso completo da conta.
          </p>

          <div class="my-profile-actions">
            <RouterLink v-if="hasConfiguredProfile" to="/profile/edit" class="btn secondary">
              Editar perfil
            </RouterLink>
            <RouterLink v-else to="/profile/setup" class="btn secondary">Completar cadastro</RouterLink>
            <button class="btn secondary" type="button" @click="handleLogout">Sair</button>
          </div>
        </div>
      </div>
    </article>

    <article class="card">
      <div class="my-products-head">
        <h2>Meus anuncios</h2>
        <RouterLink to="/my/products" class="btn secondary">Mais Detalhes</RouterLink>
      </div>

      <p v-if="!myProducts.length" class="muted" style="margin-top: 10px">
        Voce ainda nao publicou anuncios.
      </p>

      <section v-else class="my-products-preview" aria-label="Previa dos meus anuncios">
        <ProductCard
          v-for="product in highlightedMyProducts"
          :key="product.id"
          :product="product"
          class="my-product-item"
        />
      </section>
    </article>
  </section>

  <section class="card" v-else>
    <p class="muted">Faca login para visualizar seu perfil.</p>
    <div style="margin-top: 12px">
      <RouterLink to="/login" class="btn">Entrar</RouterLink>
    </div>
  </section>
</template>

<style scoped>
h1 {
  margin: 0;
}

h2 {
  margin: 0;
}

p {
  margin: 4px 0;
}

.my-profile-head {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.my-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #cbd5e1;
}

.my-info {
  display: grid;
  gap: 4px;
}

.my-profile-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.my-products-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.my-products-preview {
  margin-top: 12px;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 1fr);
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.my-product-item {
  min-width: 220px;
}

@media (max-width: 640px) {
  .my-profile-head {
    grid-template-columns: 1fr;
  }

  .my-products-head {
    flex-wrap: wrap;
  }
}
</style>
