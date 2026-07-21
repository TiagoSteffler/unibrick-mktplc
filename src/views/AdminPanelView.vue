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
import { UI_TEXTS } from '../config/messages'

const user = computed(() => authState.value)

const pendingProducts = ref([])
const reportedProducts = ref([])
const users = ref([])
const blacklistedUsers = ref([])
const searchUserQuery = ref('')

const filteredUsers = computed(() => {
  if (!searchUserQuery.value.trim()) {
    return users.value
  }
  
  const queryWords = searchUserQuery.value.toLowerCase().split(/\s+/)
  
  return users.value.filter(user => {
    const nameLower = String(user.name || '').toLowerCase()
    // Match any subword of the user's name
    return queryWords.every(word => nameLower.includes(word))
  })
})

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
  if (!window.confirm(UI_TEXTS.CONFIRM_HOME_MSG_DELETE)) {
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
  if (!window.confirm(UI_TEXTS.CONFIRM_AD_DELETE)) {
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

  if (!window.confirm(UI_TEXTS.CONFIRM_USER_DELETE)) {
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
        <textarea v-model="announcementForm.message" rows="5" maxlength="1500"
          placeholder="Mensagem exibida no topo da página inicial"></textarea>
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

        <div v-else class="grid scrollable-list" style="gap: 12px">
          <article v-for="product in pendingProducts" :key="`pending-${product.id}`" class="admin-item">
            <div class="admin-item-head">
              <h3>{{ product.title }}</h3>
              <RouterLink class="btn secondary" :to="`/product/${product.id}`">Abrir</RouterLink>
            </div>
            <p class="muted">{{ formatPrice(product.price) }} | {{ product.category }} | {{
              getModerationStatusLabel(product) }}</p>
            <p class="muted">Vendedor: {{ product.sellerName }}</p>
            <div class="action-row" style="">
              <button class="btn" type="button" :disabled="isActing"
                @click="approveProduct(product.id)">Aprovar</button>
              <button class="btn secondary" type="button" :disabled="isActing" @click="rejectProduct(product.id)">Marcar
                inválido</button>
              <button class="btn danger" type="button" :disabled="isActing"
                @click="deleteListing(product.id)">Excluir</button>
            </div>
          </article>
        </div>
      </article>

      <article class="card">
        <h2>Anúncios Reportados</h2>
        <p class="muted">{{ reportedProducts.length }} anúncio(s) reportado(s) para revisão.</p>

        <div v-if="isLoading" class="muted">Carregando...</div>

        <div v-else-if="!reportedProducts.length" class="muted">Não há anúncios reportados.</div>

        <div v-else class="grid scrollable-list" style="gap: 12px">
          <article v-for="product in reportedProducts" :key="`reported-${product.id}`"
            class="admin-item admin-item-reported">
            <div class="admin-item-content">
              <div class="admin-item-title">
                <h3>{{ product.title }}</h3>
              </div>
            </div>
            <div style="justify-content: flex-end; display: flex; align-items: center;">
              <RouterLink class="btn secondary btn-small" :to="`/product/${product.id}`">Abrir</RouterLink>
            </div>
            <div>
              <div class="admin-item-content">
                <p class="muted" style="margin: 0px 0px 6px">{{ formatPrice(product.price) }} | {{ product.category }}
                </p>
                <p class="muted" style="margin: 0px 0px 6px">Motivo: {{ product.reportReason || 'Não informado' }}</p>
                <p class="muted" style="margin: 0px 0px 6px">{{ formatDate(product.reportedAt) }}</p>
              </div>
            </div>
            <div style="gap:6px; display: flex; flex-direction: row; height: 100%; align-items: center;">
              <button class="btn btn-small" type="button" :disabled="isActing"
                @click="approveProduct(product.id)">Aprovar</button>
              <button class="btn secondary btn-small" type="button" :disabled="isActing"
                @click="rejectProduct(product.id)">Invalidar</button>
              <button class="btn danger btn-small" type="button" :disabled="isActing"
                @click="deleteListing(product.id)">Excluir</button>
            </div>
          </article>

        </div>
      </article>
    </section>

    <article class="card grid" style="gap: 12px">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2>Usuários</h2>
          <p class="muted">Controle de contas, blacklist e limpeza de dados de perfil/anúncios.</p>
        </div>
        <input 
          v-model="searchUserQuery" 
          type="search" 
          placeholder="Buscar usuário por nome..." 
          style="max-width: 300px; border-radius: 12px;" 
        />
      </div>

      <div v-if="isLoading" class="muted">Carregando usuários...</div>

      <div v-else-if="!users.length" class="muted">Nenhum usuário encontrado.</div>

      <div v-else class="grid scrollable-list" style="gap: 12px">
        <article v-for="person in filteredUsers" :key="`user-${person.uid}`" class="admin-item user-item">
          <div class="user-item-header">
            <div class="user-head">
              <h3>{{ person.name }}</h3>
              <div class="user-badges">
                <span v-if="person.isAdmin" class="badge admin">Admin</span>
                <span v-if="person.isBlacklisted" class="badge danger">Blacklisted</span>
              </div>
            </div>
            <RouterLink class="btn secondary btn-small" :to="`/seller/${person.uid}`">Abrir</RouterLink>
          </div>

          <div class="user-item-body">
            <div class="user-info-grid">
              <p class="muted"><strong>UID:</strong> {{ person.uid || 'Não informado' }}</p>
              <p class="muted"><strong>Email:</strong> {{ person.email || 'Não informado' }}</p>
              <p class="muted"><strong>Cidade:</strong> {{ person.city || 'Não informado' }}</p>
              <p class="muted"><strong>Anúncios:</strong> {{ person.productCount }}</p>
            </div>
            
            <p v-if="person.blacklistReason" class="muted text-danger" style="margin-top: 8px;">
              <strong>Motivo blacklist:</strong> {{ person.blacklistReason }}
            </p>
          </div>

          <div class="user-item-actions">
            <button v-if="!person.isAdmin && !person.isBlacklisted" class="btn danger btn-small" type="button"
              :disabled="isActing" @click="banUser(person)">Banir</button>
            <button v-if="person.isBlacklisted" class="btn secondary btn-small" type="button" :disabled="isActing"
              @click="unbanUser(person)">Remover ban</button>
            <button v-if="!person.isAdmin" class="btn secondary btn-small" type="button" :disabled="isActing"
              @click="deleteUserData(person)">Excluir dados</button>
          </div>
        </article>
        
        <p v-if="filteredUsers.length === 0" class="muted">Nenhum usuário corresponde à busca.</p>
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

.scrollable-list {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 4px;
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
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.user-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.user-info-grid p {
  margin: 0;
}

.user-item-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
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

.admin-item-reported {
  display: grid;
  grid-template-columns: auto max(220px, 25%);
  grid-template-rows: 50px auto;
  gap: 12px;
  align-items: top;
}

.admin-item-content {
  display: grid;
  gap: 6px;
}

.admin-item-title {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}

.admin-item-title h3 {
  margin: 0;
}

.btn-small {
  padding: 6px 12px;
  font-size: 13px;
}

.admin-item-actions {
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  gap: 8px;
  min-width: fit-content;
}
</style>
