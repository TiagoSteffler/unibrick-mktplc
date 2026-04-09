<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authState, deleteAuthenticatedUser, isAdminSession, signOutUser } from '../services/authService'
import { deleteUserChatData } from '../services/chatService'
import AppModal from '../components/AppModal.vue'
import ProductCard from '../components/ProductCard.vue'
import {
  deleteUserMarketplaceData,
  getMyProducts,
  getMyProfile,
  isUserProfileComplete,
} from '../services/marketplaceService'

const router = useRouter()
const route = useRoute()
const user = computed(() => authState.value)
const isAdmin = computed(() => Boolean(isAdminSession.value))
const profile = ref(null)
const myProducts = ref([])
const isLoading = ref(false)
const isDeletingAccount = ref(false)
const showDeleteAccountModal = ref(false)
const accountActionError = ref('')
const hasConfiguredProfile = computed(() => (isLoading.value ? true : isUserProfileComplete(profile.value)))
const highlightedMyProducts = computed(() => myProducts.value.slice(0, 3))
const accountDeletionEffects = [
  'seus dados de perfil',
  'seus anúncios',
  'suas conversas ativas',
]

function formatDate(value) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value || 'Não informado'
  }

  return parsed.toLocaleDateString('pt-BR')
}

async function loadProfile() {
  isLoading.value = true

  if (!user.value) {
    profile.value = null
    myProducts.value = []
    isLoading.value = false
    return
  }

  try {
    profile.value = await getMyProfile(user.value)
    myProducts.value = await getMyProducts(user.value)
  } finally {
    isLoading.value = false
  }
}

async function handleLogout() {
  await signOutUser()
  router.replace('/')
}

function handleDeleteAccount() {
  if (!user.value || isDeletingAccount.value) {
    return
  }

  showDeleteAccountModal.value = true
}

async function confirmDeleteAccount() {
  isDeletingAccount.value = true
  accountActionError.value = ''

  try {
    const currentUser = user.value
    await deleteUserChatData(currentUser)
    await deleteUserMarketplaceData(currentUser)
    await deleteAuthenticatedUser()
    showDeleteAccountModal.value = false
    router.replace('/')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao excluir a conta. Tente novamente.'
    const isPermissionDenied =
      String(err?.code || '').includes('permission-denied') ||
      message.includes('Missing or insufficient permissions')

    accountActionError.value = isPermissionDenied
      ? 'Permissão insuficiente no Firebase para remover todos os dados da conta. Revise as regras do Firestore/Storage para permitir exclusão dos dados do próprio usuário.'
      : message
  } finally {
    isDeletingAccount.value = false
  }
}

onMounted(() => {
  loadProfile()
})

watch(user, () => {
  loadProfile()
})

watch(
  () => route.name,
  (newRouteName) => {
    if (newRouteName === 'profile') {
      loadProfile()
    }
  },
)
</script>

<template>
  <section class="grid loading-section" style="gap: 16px" v-if="user">
    <div v-if="isLoading" class="section-loading-overlay" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <p>Carregando perfil...</p>
    </div>

    <article class="card">
      <div class="my-profile-head">
        <div class="my-avatar-container">
          <img
            v-if="profile?.photoURL"
            :src="profile.photoURL"
            alt="Minha foto de perfil"
            class="my-avatar"
          />
          <div v-else class="my-avatar-default">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        </div>

        <div class="my-info">
          <h1>{{ profile?.fullName || user.displayName || 'Meu perfil' }}</h1>
          <p><strong>Cidade natal:</strong> {{ profile?.city || 'Não informado' }}</p>
          <p><strong>Curso/Ocupação:</strong> {{ profile?.universityRole || 'Não informado' }}</p>
          <p><strong>Desde:</strong> {{ formatDate(profile?.joinedAt) }}</p>
          <p class="my-about-row">
            <strong>Sobre mim:</strong>
            <span class="about-text">{{ profile?.about || 'Não Disponível' }}</span>
          </p>

          <p v-if="!hasConfiguredProfile" class="muted" style="margin-top: 6px">
            Complete seu cadastro para liberar edição de perfil e uso completo da conta.
          </p>

          <div class="my-profile-actions">
            <RouterLink v-if="hasConfiguredProfile" to="/profile/edit" class="btn secondary">
              Editar perfil
            </RouterLink>
            <RouterLink v-else to="/profile/setup" class="btn secondary">Completar cadastro</RouterLink>
            <button
              v-if="!isAdmin"
              class="btn danger"
              type="button"
              @click="handleDeleteAccount"
              :disabled="isDeletingAccount"
            >
              {{ isDeletingAccount ? 'Excluindo conta...' : 'Excluir conta' }}
            </button>
            <button class="btn secondary" type="button" @click="handleLogout">Sair</button>
          </div>

          <p v-if="accountActionError" class="account-error">
            {{ accountActionError }}
          </p>
        </div>
      </div>
   </article>

    <article class="card">
      <div class="my-products-head">
        <h2>Meus anúncios</h2>
        <RouterLink to="/my/products" class="btn secondary">Mais Detalhes</RouterLink>
      </div>

      <p v-if="!myProducts.length" class="muted" style="margin: 10px 18px">
        Você ainda não publicou anúncios.
      </p>

      <section v-else class="grid products  " aria-label="Previa dos meus anúncios">
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

  <AppModal
    v-model="showDeleteAccountModal"
    variant="danger"
    title="Excluir conta"
    message="Ao apagar sua conta você perderá o acesso permanentemente e os itens abaixo serão excluídos:"
    :details="accountDeletionEffects"
    confirm-text="Excluir conta"
    confirm-text-busy="Excluindo conta..."
    cancel-text="Cancelar"
    require-text="EXCLUIR"
    require-text-label="Digite exatamente"
    require-text-placeholder="EXCLUIR"
    :busy="isDeletingAccount"
    :close-on-backdrop="false"
    @confirm="confirmDeleteAccount"
  />
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
  padding: 16px 30px;
  display: grid;
  grid-template-columns: 1fr minmax(0, 4fr);
  gap: 30px;
  align-items: start;
  height:auto;
  
}

.my-avatar-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  aspect-ratio: 1;
}

.my-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid #cbd5e1;
}

.my-avatar-default {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  background: #f1f5f9;
  color: #94a3b8;
}

.my-avatar-default svg {
  width: 60px;
  height: 60px;
}

.my-info {
  display: grid;
  gap: 4px;
}

.my-about-row {
  display: grid;
  gap: 2px;
}

.about-text {
  white-space: pre-line;
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
  margin: 18px;
  font-size: 18px;
}

.account-error {
  margin-top: 10px;
  color: #b91c1c;
  font-size: 14px;
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
