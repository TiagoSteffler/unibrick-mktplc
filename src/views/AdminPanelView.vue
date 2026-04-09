<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { authState } from '../services/authService'
import { deleteUserChatData } from '../services/chatService'
import {
  approveProductByAdmin,
  banUserByAdmin,
  clearHomeMessageByAdmin,
  deleteProduct,
  deleteUserDataByAdmin,
  getBlacklistedUsers,
  getHomeMessage,
  getPendingProductsForAdmin,
  getReportedProductsForAdmin,
  getUsersForAdmin,
  rejectProductByAdmin,
  saveHomeMessageByAdmin,
  unbanUserByAdmin,
} from '../services/marketplaceService'

const user = computed(() => authState.value)

const pendingProducts = ref([])
const reportedProducts = ref([])
const users = ref([])
const blacklistedUsers = ref([])

const announcementForm = reactive({
  title: '',
  message: '',
})

const isLoading = ref(false)
const isActing = ref(false)
const statusMessage = ref('')
const statusError = ref('')

function clearStatus() {
  statusMessage.value = ''
  statusError.value = ''
}

function formatPrice(value) {
  const numberValue = Number(value || 0)
  return numberValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(value) {
  if (!value) {
    return 'Não informado'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('pt-BR')
}

function getModerationStatusLabel(product) {
  const status = String(product?.moderationStatus || '').toLowerCase()

  if (status === 'pending') {
    return 'Aguardando aprovação'
  }

  if (status === 'reported') {
    return 'Reportado'
  }

  if (status === 'rejected') {
    return 'Rejeitado'
  }

  return 'Aprovado'
}

async function loadAdminData() {
  if (!user.value) {
    return
  }

  isLoading.value = true

  try {
    const [pending, reported, usersList, blacklist, homeMessage] = await Promise.all([
      getPendingProductsForAdmin(user.value),
      getReportedProductsForAdmin(user.value),
      getUsersForAdmin(user.value),
      getBlacklistedUsers(user.value),
      getHomeMessage(),
    ])

    pendingProducts.value = pending
    reportedProducts.value = reported
    users.value = usersList
    blacklistedUsers.value = blacklist
    announcementForm.title = String(homeMessage?.title || '')
    announcementForm.message = String(homeMessage?.message || '')
  } catch (err) {
    statusError.value = err instanceof Error ? err.message : 'Falha ao carregar painel administrativo.'
  } finally {
    isLoading.value = false
  }
}

async function runAdminAction(action, successMessage) {
  if (isActing.value) {
    return
  }

  isActing.value = true
  clearStatus()

  try {
    await action()
    statusMessage.value = successMessage
    await loadAdminData()
  } catch (err) {
    statusError.value = err instanceof Error ? err.message : 'Falha na ação administrativa.'
  } finally {
    isActing.value = false
  }
}

function saveAnnouncement() {
  runAdminAction(
    async () => {
      await saveHomeMessageByAdmin(user.value, {
        title: announcementForm.title,
        message: announcementForm.message,
      })
    },
    'Mensagem da home atualizada com sucesso.',
  )
}

function clearAnnouncement() {
  if (!window.confirm('Deseja remover a mensagem da página inicial?')) {
    return
  }

  runAdminAction(
    async () => {
      await clearHomeMessageByAdmin(user.value)
      announcementForm.title = ''
      announcementForm.message = ''
    },
    'Mensagem da home removida.',
  )
}

function approveProduct(productId) {
  runAdminAction(
    async () => {
      await approveProductByAdmin(productId, user.value)
    },
    'Anúncio aprovado com sucesso.',
  )
}

function rejectProduct(productId) {
  const reason = window.prompt('Motivo para marcar anúncio como inválido:', '')

  if (reason === null) {
    return
  }

  runAdminAction(
    async () => {
      await rejectProductByAdmin(productId, user.value, reason)
    },
    'Anúncio marcado como inválido com sucesso.',
  )
}

function deleteListing(productId) {
  if (!window.confirm('Deseja excluir este anúncio? Esta ação não pode ser desfeita.')) {
    return
  }

  runAdminAction(
    async () => {
      await deleteProduct(productId, user.value)
    },
    'Anúncio excluido com sucesso.',
  )
}

function banUser(targetUser) {
  if (!targetUser?.uid && !targetUser?.email) {
    statusError.value = 'Usuário inválido para blacklist.'
    return
  }

  const reason = window.prompt('Motivo do banimento (opcional):', '')

  if (reason === null) {
    return
  }

  runAdminAction(
    async () => {
      await banUserByAdmin(user.value, targetUser, reason)
    },
    'Usuário adicionado a blacklist.',
  )
}

function unbanUser(targetUser) {
  runAdminAction(
    async () => {
      await unbanUserByAdmin(user.value, targetUser)
    },
    'Usuário removido da blacklist.',
  )
}

function deleteUserData(targetUser) {
  if (!targetUser?.uid) {
    statusError.value = 'UID obrigatório para excluir dados de usuário.'
    return
  }

  if (!window.confirm('Excluir perfil, anúncios e conversas deste usuário?')) {
    return
  }

  runAdminAction(
    async () => {
      await deleteUserDataByAdmin(user.value, targetUser)
      await deleteUserChatData({ uid: targetUser.uid })
    },
    'Dados do usuário removidos com sucesso.',
  )
}

onMounted(() => {
  loadAdminData()
})
</script>

<template>
  <section class="grid" style="gap: 16px">
    <article class="card">
      <h1>Painel Administrativo</h1>
      <p class="muted">Gerencie moderacao de anúncios, blacklist de usuários e mensagens da página inicial.</p>
      <p v-if="statusMessage" class="status-message success">{{ statusMessage }}</p>
      <p v-if="statusError" class="status-message error">{{ statusError }}</p>
    </article>

    <article class="card grid" style="gap: 10px">
      <h2>Mensagem da Home</h2>
      <label class="field">
        <span>Título</span>
        <input v-model="announcementForm.title" type="text" maxlength="120" placeholder="Título da mensagem" />
      </label>

      <label class="field">
        <span>Mensagem</span>
        <textarea
          v-model="announcementForm.message"
          rows="5"
          maxlength="1500"
          placeholder="Mensagem exibida no topo da página inicial"
        ></textarea>
      </label>

      <div class="action-row">
        <button class="btn" type="button" :disabled="isActing" @click="saveAnnouncement">
          {{ isActing ? 'Salvando...' : 'Salvar mensagem' }}
        </button>
        <button class="btn secondary" type="button" :disabled="isActing" @click="clearAnnouncement">
          Remover mensagem
        </button>
      </div>
    </article>

    <section class="grid two-columns" style="gap: 16px">
      <article class="card">
        <h2>Anúncios Pendentes</h2>
        <p class="muted">{{ pendingProducts.length }} anúncio(s) aguardando aprovação.</p>

        <div v-if="isLoading" class="muted">Carregando...</div>

        <div v-else-if="!pendingProducts.length" class="muted">Não há anúncios pendentes.</div>

        <div v-else class="grid" style="gap: 12px">
          <article v-for="product in pendingProducts" :key="`pending-${product.id}`" class="admin-item">
            <div class="admin-item-head">
              <h3>{{ product.title }}</h3>
              <RouterLink class="btn secondary" :to="`/product/${product.id}`">Abrir</RouterLink>
            </div>
            <p class="muted">{{ formatPrice(product.price) }} | {{ product.category }} | {{ getModerationStatusLabel(product) }}</p>
            <p class="muted">Vendedor: {{ product.sellerName }}</p>
            <div class="action-row">
              <button class="btn" type="button" :disabled="isActing" @click="approveProduct(product.id)">Aprovar</button>
              <button class="btn secondary" type="button" :disabled="isActing" @click="rejectProduct(product.id)">Marcar inválido</button>
              <button class="btn danger" type="button" :disabled="isActing" @click="deleteListing(product.id)">Excluir</button>
            </div>
          </article>
        </div>
      </article>

      <article class="card">
        <h2>Anúncios Reportados</h2>
        <p class="muted">{{ reportedProducts.length }} anúncio(s) reportado(s) para revisão.</p>

        <div v-if="isLoading" class="muted">Carregando...</div>

        <div v-else-if="!reportedProducts.length" class="muted">Não há anúncios reportados.</div>

        <div v-else class="grid" style="gap: 12px">
          <article v-for="product in reportedProducts" :key="`reported-${product.id}`" class="admin-item">
            <div class="admin-item-head">
              <h3>{{ product.title }}</h3>
              <RouterLink class="btn secondary" :to="`/product/${product.id}`">Abrir</RouterLink>
            </div>
            <p class="muted">{{ formatPrice(product.price) }} | {{ product.category }} | {{ getModerationStatusLabel(product) }}</p>
            <p class="muted">Motivo do reporte: {{ product.reportReason || 'Não informado' }}</p>
            <p class="muted">Reportado em: {{ formatDate(product.reportedAt) }}</p>
            <div class="action-row">
              <button class="btn" type="button" :disabled="isActing" @click="approveProduct(product.id)">Aprovar</button>
              <button class="btn secondary" type="button" :disabled="isActing" @click="rejectProduct(product.id)">Marcar inválido</button>
              <button class="btn danger" type="button" :disabled="isActing" @click="deleteListing(product.id)">Excluir</button>
            </div>
          </article>
        </div>
      </article>
    </section>

    <article class="card grid" style="gap: 12px">
      <h2>Usuários</h2>
      <p class="muted">Controle de contas, blacklist e limpeza de dados de perfil/anúncios.</p>

      <div v-if="isLoading" class="muted">Carregando usuários...</div>

      <div v-else-if="!users.length" class="muted">Nenhum usuário encontrado.</div>

      <div v-else class="grid" style="gap: 10px">
        <article v-for="person in users" :key="`user-${person.uid}`" class="admin-item user-item">
          <div class="user-head">
            <h3>{{ person.name }}</h3>
            <div class="user-badges">
              <span v-if="person.isAdmin" class="badge admin">Admin</span>
              <span v-if="person.isBlacklisted" class="badge danger">Blacklisted</span>
            </div>
          </div>

          <p class="muted">UID: {{ person.uid || 'Não informado' }}</p>
          <p class="muted">Email: {{ person.email || 'Não informado' }}</p>
          <p class="muted">Cidade: {{ person.city || 'Não informado' }}</p>
          <p class="muted">Anúncios: {{ person.productCount }}</p>
          <p v-if="person.blacklistReason" class="muted">Motivo blacklist: {{ person.blacklistReason }}</p>

          <div class="action-row">
            <button
              v-if="!person.isAdmin && !person.isBlacklisted"
              class="btn danger"
              type="button"
              :disabled="isActing"
              @click="banUser(person)"
            >
              Banir
            </button>

            <button
              v-if="person.isBlacklisted"
              class="btn secondary"
              type="button"
              :disabled="isActing"
              @click="unbanUser(person)"
            >
              Remover ban
            </button>

            <button
              v-if="!person.isAdmin"
              class="btn secondary"
              type="button"
              :disabled="isActing"
              @click="deleteUserData(person)"
            >
              Excluir dados
            </button>
          </div>
        </article>
      </div>
    </article>

    <article class="card" v-if="blacklistedUsers.length">
      <h2>Resumo da Blacklist</h2>
      <ul class="blacklist-list">
        <li v-for="entry in blacklistedUsers" :key="`blacklist-${entry.id}`">
          {{ entry.email || entry.uid || entry.id }} | {{ entry.reason || 'Sem motivo informado' }}
        </li>
      </ul>
    </article>
  </section>
</template>

<style scoped>
h1,
h2,
h3 {
  margin: 0;
}

.two-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.admin-item {
  border: 1px solid #dbe4ee;
  border-radius: 14px;
  padding: 12px;
  background: #fbfdff;
}

.admin-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.user-item {
  background: #ffffff;
}

.user-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.user-badges {
  display: flex;
  gap: 6px;
}

.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.badge.admin {
  background: #dbeafe;
  color: #1e3a8a;
}

.badge.danger {
  background: #fee2e2;
  color: #991b1b;
}

.blacklist-list {
  margin: 10px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
  color: #334155;
}

@media (max-width: 980px) {
  .two-columns {
    grid-template-columns: 1fr;
  }
}
</style>
