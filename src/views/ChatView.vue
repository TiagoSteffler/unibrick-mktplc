<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState } from '../services/authService'
import {
  getMyProducts,
  getProductById,
  getSellerById,
  isUserBlacklisted,
  resolveUserAccess,
} from '../services/marketplaceService'
import {
  buildDirectConversationDraft,
  clearConversationMessages,
  deleteConversationIfEmpty,
  ensureDirectConversation,
  ensureUniBrikConversation,
  getConversationMessages,
  getConversationPeer,
  getUnreadCountForUser,
  listenToUserConversations,
  listenToConversationMessages,
  loadPreviousMessages,
  markConversationAsRead,
  sendChatMessage,
  sendSystemBroadcast,
} from '../services/chatService'
import { UI_TEXTS } from '../config/messages'

const route = useRoute()
const router = useRouter()
const user = computed(() => authState.value)

const conversations = ref([])
const activeConversationId = ref('')
const messages = ref([])
const draftMessage = ref('')
const pendingAttachment = ref(null)
const ephemeralConversationId = ref('')
const chatError = ref('')

const unsubscribeConversations = ref(null)
const unsubscribeMessages = ref(null)
const deletedProducts = ref(new Set())

async function checkAttachments(msgs) {
  const ids = new Set(msgs.filter(m => m.attachment).map(m => m.attachment.productId))
  ids.forEach(async id => {
    if (deletedProducts.value.has(id)) return
    try {
      const prod = await getProductById(id)
      if (!prod) deletedProducts.value.add(id)
    } catch {
      deletedProducts.value.add(id)
    }
  })
}

const isLoadingConversations = ref(false)
const isLoadingMessages = ref(false)
const isSending = ref(false)
const canLoadMore = ref(false)
const isLoadingMore = ref(false)

const hasConversations = computed(() => conversations.value.length > 0)
const activeConversation = computed(
  () => conversations.value.find((conversation) => conversation.id === activeConversationId.value) || null,
)
const activePeer = computed(() => getConversationPeer(activeConversation.value, user.value?.uid || ''))
const activeTopicProduct = computed(() => activeConversation.value?.topicProduct || null)

const isAdmin = ref(false)
const messagesContainer = ref(null)

function scrollToBottom() {
  setTimeout(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }, 50)
}

const isReadOnlyConversation = computed(() => {
  if (activeConversation.value?.type === 'system' && isAdmin.value) return false
  return Boolean(activeConversation.value?.readOnly) || Boolean(activeTopicProduct.value?.deleted)
})

const hasBuyerFirstMessage = computed(() => {
  const buyerId = activeTopicProduct.value?.buyerId

  if (!buyerId) {
    return true
  }

  return messages.value.some((message) => message.kind !== 'topic-intro' && message.senderId === buyerId)
})

const hasTopicIntroMessage = computed(() => messages.value.some((message) => message.kind === 'topic-intro'))

const showTopicPreviewBanner = computed(
  () =>
    Boolean(
      activeTopicProduct.value &&
        user.value?.uid &&
        activeTopicProduct.value.buyerId === user.value.uid &&
        !hasBuyerFirstMessage.value,
    ),
)

function getUnreadCount(conversation) {
  return getUnreadCountForUser(conversation, user.value?.uid || '')
}

function formatTimestamp(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isOwnMessage(message) {
  return message.senderId === user.value?.uid
}

function getTopicIntroText(message) {
  const title = String(message.topicProductTitle || activeTopicProduct.value?.title || '').trim()
  const safeTitle = title || 'anúncio sem título'
  const isBuyer = message.topicBuyerId === user.value?.uid

  return isBuyer
    ? `Você perguntou sobre: ${safeTitle}`
    : `O comprador perguntou sobre: ${safeTitle}`
}

function buildAttachmentFromProduct(product) {
  if (!product) {
    return null
  }

  return {
    productId: product.id,
    title: product.title,
    price: Number(product.price || 0),
    photo: Array.isArray(product.photos) ? product.photos[0] || '' : '',
  }
}

async function loadConversations() {
  if (unsubscribeConversations.value) {
    unsubscribeConversations.value()
  }

  if (!user.value) {
    conversations.value = []
    activeConversationId.value = ''
    messages.value = []
    return
  }

  isLoadingConversations.value = true
  chatError.value = ''

  return new Promise((resolve) => {
    let isFirst = true
    unsubscribeConversations.value = listenToUserConversations(user.value, (data) => {
      conversations.value = data
      if (!activeConversationId.value && conversations.value.length) {
        activeConversationId.value = conversations.value[0].id
      }
      isLoadingConversations.value = false
      if (isFirst) {
        isFirst = false
        resolve()
      }
    })
  })
}

async function loadMessages() {
  if (unsubscribeMessages.value) {
    unsubscribeMessages.value()
  }

  if (!activeConversationId.value) {
    messages.value = []
    return
  }

  isLoadingMessages.value = true
  chatError.value = ''
  canLoadMore.value = false

  return new Promise((resolve) => {
    let isFirst = true
    unsubscribeMessages.value = listenToConversationMessages(activeConversation.value, async (data) => {
      canLoadMore.value = data.length >= 15
      const clearTimeStr = activeConversation.value?.clearedAt?.[user.value?.uid]
      let filtered = data
      if (clearTimeStr) {
        const clearTime = new Date(clearTimeStr).getTime()
        filtered = data.filter(m => new Date(m.createdAt).getTime() > clearTime)
      }
      
      messages.value = filtered
      isLoadingMessages.value = false
      checkAttachments(filtered)
      scrollToBottom()

      if (user.value && activeConversation.value) {
        await markConversationAsRead(user.value, activeConversation.value)

        conversations.value = conversations.value.map((conversation) => {
          if (conversation.id !== activeConversation.value?.id) {
            return conversation
          }

          return {
            ...conversation,
            unreadCounts: {
              ...(conversation.unreadCounts || {}),
              [user.value.uid]: 0,
            },
          }
        })
      }
      
      if (isFirst) {
        isFirst = false
        resolve()
      }
    })
  })
}

async function ensureSystemConversation() {
  if (!user.value) {
    return
  }

  try {
    await ensureUniBrikConversation(user.value)
  } catch {
    // Falha silenciosa
  }
}

function buildTopicProduct(product) {
  if (!product || !user.value?.uid) {
    return null
  }

  return {
    productId: product.id,
    title: String(product.title || '').trim() || 'Anúncio',
    buyerId: user.value.uid,
  }
}

async function handleProductChatIntent() {
  const sellerId = typeof route.query.sellerId === 'string' ? route.query.sellerId : ''
  const productId = typeof route.query.productId === 'string' ? route.query.productId : ''

  try {
    let product = null

    if (productId) {
      try {
        product = await getProductById(productId)
      } catch {
        product = null
      }

      pendingAttachment.value = product ? buildAttachmentFromProduct(product) : null
    }

    let seller = null

    try {
      seller = await getSellerById(sellerId)
    } catch {
      seller = null
    }

    if (productId) {
      if (!product) {
        throw new Error('Este anúncio não está mais disponível para iniciar conversa.')
      }

      if (String(product.sellerId || '') !== sellerId) {
        throw new Error('O anúncio informado não pertence ao vendedor selecionado.')
      }

      const moderationStatus = String(product.moderationStatus || '').trim().toLowerCase()

      if (moderationStatus !== 'approved') {
        throw new Error('Só é possível iniciar conversa por anúncios aprovados.')
      }
    }

    const sellerBlacklisted = await isUserBlacklisted({
      uid: sellerId,
      email: String(seller?.email || '').trim().toLowerCase(),
    })

    if (sellerBlacklisted) {
      throw new Error('Não é possível iniciar conversa com este vendedor no momento.')
    }

    const sellerPayload = {
      id: sellerId,
      name: seller?.name || 'Vendedor',
      photoURL: seller?.photoURL || '',
    }

    const topicProduct = buildTopicProduct(product)

    const existing = conversations.value.find((conversation) =>
      conversation.participants?.includes(user.value.uid) && conversation.participants?.includes(sellerId),
    )

    const shouldPatchTopicOnExisting = Boolean(existing && topicProduct && !existing.topicProduct)

    const conversation = shouldPatchTopicOnExisting
      ? await ensureDirectConversation(user.value, sellerPayload, { topicProduct })
      : existing || buildDirectConversationDraft(user.value, sellerPayload, { topicProduct })

    const alreadyInList = conversations.value.some((item) => item.id === conversation.id)

    if (!alreadyInList) {
      conversations.value = [conversation, ...conversations.value]
    } else {
      conversations.value = conversations.value.map((item) =>
        item.id === conversation.id ? conversation : item,
      )
    }

    if (!existing) {
      ephemeralConversationId.value = conversation.id
    }

    activeConversationId.value = conversation.id

    router.replace({ name: 'chat', query: { conversation: conversation.id } })
  } catch (err) {
    chatError.value = err instanceof Error ? err.message : 'Falha ao iniciar conversa com o vendedor.'
  }
}

function selectConversation(conversationId) {
  activeConversationId.value = conversationId
  pendingAttachment.value = null
  chatError.value = ''
  router.replace({
    name: 'chat',
    query: { conversation: conversationId },
  })
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

async function sendMessage() {
  if (!activeConversation.value || isSending.value) {
    return
  }

  const text = draftMessage.value.trim()

  if (!text && !pendingAttachment.value) {
    return
  }

  chatError.value = ''
  isSending.value = true

  try {
    const currentConversation = activeConversation.value

    if (!currentConversation) {
      return
    }

    if (currentConversation.type === 'system' && isAdmin.value) {
      await sendSystemBroadcast(user.value, text)
      draftMessage.value = ''
      pendingAttachment.value = null
      scrollToBottom()
      isSending.value = false
      return
    }

    const shouldSendTopicIntro = Boolean(
      activeTopicProduct.value &&
        user.value?.uid &&
        activeTopicProduct.value.buyerId === user.value.uid &&
        !hasBuyerFirstMessage.value &&
        !hasTopicIntroMessage.value,
    )

    await sendChatMessage(user.value, currentConversation, {
      text,
      attachment: pendingAttachment.value,
      topicIntro: shouldSendTopicIntro ? activeTopicProduct.value : null,
    })

    draftMessage.value = ''
    pendingAttachment.value = null
    ephemeralConversationId.value = ''

    await loadConversations()
    await loadMessages()
  } catch (err) {
    chatError.value = err instanceof Error ? err.message : 'Falha ao enviar mensagem.'
  } finally {
    isSending.value = false
  }
}

async function clearActiveConversation() {
  if (!activeConversation.value || !user.value) return
  if (!window.confirm(UI_TEXTS.CONFIRM_CHAT_DELETE)) return

  try {
    await clearConversationMessages(activeConversation.value, user.value)
    messages.value = []
  } catch (err) {
    chatError.value = err instanceof Error ? err.message : 'Falha ao apagar conversa.'
  }
}

async function loadMoreMessages() {
  if (isLoadingMore.value || !messages.value.length || !activeConversation.value) return
  
  isLoadingMore.value = true
  try {
    const oldestMessageTime = messages.value[0].createdAt
    const olderMessages = await loadPreviousMessages(activeConversation.value, oldestMessageTime)
    
    const clearTimeStr = activeConversation.value?.clearedAt?.[user.value?.uid]
    let filteredOlder = olderMessages
    if (clearTimeStr) {
      const clearTime = new Date(clearTimeStr).getTime()
      filteredOlder = olderMessages.filter(m => new Date(m.createdAt).getTime() > clearTime)
    }

    if (filteredOlder.length < 15) {
      canLoadMore.value = false
    }
    
    messages.value = [...filteredOlder, ...messages.value]
  } catch (err) {
    chatError.value = 'Falha ao carregar mensagens antigas.'
  } finally {
    isLoadingMore.value = false
  }
}

function isConversationCleared(conversation) {
  if (!user.value || !conversation) return false
  const clearTimeStr = conversation.clearedAt?.[user.value.uid]
  if (!clearTimeStr) return false
  const clearTime = new Date(clearTimeStr).getTime()
  const updatedTime = new Date(conversation.updatedAt).getTime()
  return updatedTime <= clearTime
}

async function initializeChat() {
  if (!user.value) {
    return
  }

  chatError.value = ''

  await ensureSystemConversation()
  await loadConversations()

  await handleProductChatIntent()

  const requestedConversation = typeof route.query.conversation === 'string' ? route.query.conversation : ''

  if (requestedConversation && conversations.value.some((item) => item.id === requestedConversation)) {
    activeConversationId.value = requestedConversation
  }

  await loadMessages()
}

onMounted(async () => {
  if (user.value) {
    const access = await resolveUserAccess(user.value)
    isAdmin.value = access.isAdmin
  }
  initializeChat()
})

onBeforeUnmount(async () => {
  if (unsubscribeConversations.value) unsubscribeConversations.value()
  if (unsubscribeMessages.value) unsubscribeMessages.value()

  if (!ephemeralConversationId.value) {
    return
  }

  await deleteConversationIfEmpty(ephemeralConversationId.value)
})

watch(
  () => activeConversationId.value,
  () => {
    loadMessages()
  },
)
</script>

<template>
  <section class="chat-layout loading-section">
    <div v-if="isLoadingConversations" class="section-loading-overlay" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <p>Carregando conversas...</p>
    </div>

    <aside class="card chat-sidebar">
      <h1>Conversas</h1>

      <p v-if="chatError" class="chat-error">{{ chatError }}</p>

      <p v-if="!hasConversations" class="muted" style="margin-top: 10px">
        Você não tem nenhuma conversa ativa.
      </p>

      <ul v-else class="chat-conversation-list">
        <li v-for="conversation in conversations" :key="conversation.id">
          <button
            type="button"
            class="chat-conversation-item"
            :class="{ 
              active: conversation.id === activeConversationId,
              deleted: conversation.topicProduct?.deleted === true
            }"
            :disabled="conversation.topicProduct?.deleted === true"
            @click="selectConversation(conversation.id)"
          >
            <div class="chat-conversation-head">
              <strong>{{ getConversationPeer(conversation, user?.uid || '').name }}</strong>
              <span v-if="getUnreadCount(conversation) > 0" class="chat-unread-badge">
                {{ getUnreadCount(conversation) }}
              </span>
            </div>
            <small class="muted">{{ isConversationCleared(conversation) ? 'Sem mensagens recentes' : (conversation.lastMessagePreview || 'Sem mensagens') }}</small>
          </button>
        </li>
      </ul>
    </aside>

    <section class="card chat-main" v-if="hasConversations && activeConversation">
      <header class="chat-main-header">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; width: 100%;">
          <div>
            <h2>{{ activeTopicProduct ? activeTopicProduct.title : (activePeer?.name || 'Conversa') }}</h2>
            <p v-if="activeTopicProduct" class="muted">Vendedor: {{ activePeer?.name }}</p>
            <p v-if="isReadOnlyConversation" class="muted">Conversa somente leitura.</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" @click="clearActiveConversation" class="btn btn-sm btn-danger" style="background-color: #ef4444; color: white; border: none;">
              Apagar Chat
            </button>
            <RouterLink v-if="activeTopicProduct && !activeTopicProduct.deleted" :to="`/product/${activeTopicProduct.productId}`" class="btn btn-sm">
              Ir ao anúncio
            </RouterLink>
          </div>
        </div>
      </header>

      <div v-if="activeTopicProduct?.deleted === true" class="chat-topic-banner chat-error-banner" style="background-color: #fee2e2; border-color: #fca5a5;">
        <strong style="color: #991b1b;">Este chat foi finalizado pois o anúncio foi removido.</strong>
      </div>

      <section class="chat-messages loading-section" ref="messagesContainer">
        <div v-if="isLoadingMessages" class="section-loading-overlay" aria-live="polite">
          <span class="spinner" aria-hidden="true"></span>
          <p>Carregando mensagens...</p>
        </div>

        <div v-if="canLoadMore && !isLoadingMessages && messages.length > 0" style="text-align: center; padding-bottom: 10px;">
          <button @click="loadMoreMessages" class="btn btn-sm" :disabled="isLoadingMore">
            {{ isLoadingMore ? 'Carregando...' : 'Carregar mensagens anteriores' }}
          </button>
        </div>

        <article
          v-for="message in messages"
          :key="message.id"
          class="chat-message"
          :class="{
            own: message.kind !== 'topic-intro' && isOwnMessage(message),
            topic: message.kind === 'topic-intro',
          }"
        >
          <template v-if="message.kind === 'topic-intro'">
            <p class="chat-topic-intro">
              <strong>{{ getTopicIntroText(message) }}</strong>
            </p>
          </template>

          <template v-else>
            <p v-if="message.text" class="chat-message-text">{{ message.text }}</p>

            <div v-if="message.attachment" class="chat-attachment-wrapper">
              <RouterLink
                v-if="!deletedProducts.has(message.attachment.productId)"
                :to="`/product/${message.attachment.productId}`"
                class="chat-attachment"
              >
                <img
                  v-if="message.attachment.photo"
                  :src="message.attachment.photo"
                  :alt="message.attachment.title"
                />
                <div>
                  <strong>{{ message.attachment.title }}</strong>
                  <small class="muted">
                    R$ {{ Number(message.attachment.price || 0).toFixed(2) }}
                  </small>
                </div>
              </RouterLink>
              <div v-else class="chat-attachment chat-attachment-deleted" style="opacity: 0.6; cursor: not-allowed; filter: grayscale(1);">
                <div class="chat-attachment-icon" style="font-size: 24px; display: grid; place-items: center; width: 64px; height: 64px; background: #f1f5f9; border-radius: 8px;">🚫</div>
                <div>
                  <strong style="color: #64748b;">Anúncio indisponível</strong>
                  <small class="muted">
                    R$ {{ Number(message.attachment.price || 0).toFixed(2) }}
                  </small>
                </div>
              </div>
            </div>

            <small class="chat-message-time">{{ formatTimestamp(message.createdAt) }}</small>
          </template>
        </article>
      </section>

      <footer class="chat-composer">
        <div v-if="pendingAttachment" class="chat-pending-attachment">
          <small class="muted">Anexo será enviado na próxima mensagem:</small>
          <strong>{{ pendingAttachment.title }}</strong>
        </div>

        <form class="chat-composer-form" @submit.prevent="sendMessage">
          <textarea
            v-model="draftMessage"
            rows="2"
            placeholder="Digite sua mensagem"
            :disabled="isReadOnlyConversation || isSending"
            @keydown="handleKeydown"
          ></textarea>
          <button class="btn btn-icon" type="submit" :disabled="isReadOnlyConversation || isSending || (!draftMessage.trim() && !pendingAttachment)" title="Enviar" style="height: 52px; width: 52px; padding: 0; display: flex; align-items: center; justify-content: center;">
            <svg v-if="!isSending" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            <span v-else class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></span>
          </button>
        </form>
      </footer>
    </section>

    <section v-else class="card chat-empty-state">
      <p class="muted">Você não tem nenhuma conversa ativa.</p>
    </section>
  </section>
</template>

<style scoped>
.chat-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.chat-sidebar {
  min-height: 80vh;
}

.chat-sidebar h1 {
  margin: 0;
}

.chat-conversation-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.chat-conversation-item {
  width: 100%;
  border: 1px solid #dbe4ee;
  border-radius: 12px;
  background: #f8fafc;
  text-align: left;
  padding: 10px;
  display: grid;
  gap: 4px;
  cursor: pointer;
}

.chat-conversation-item small {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.chat-conversation-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-unread-badge {
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #0284c7;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
  padding: 0 6px;
}

.chat-conversation-item.active {
  border-color: #60a5fa;
  background: #eff6ff;
}

.chat-conversation-item.deleted {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(1);
}

.chat-main {
  height: 80vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 12px;
}

.chat-error {
  margin: 8px 0 0;
  color: #b91c1c;
}

.chat-main-header h2 {
  margin: 0;
}

.chat-main-header p {
  margin: 4px 0 0;
}

.chat-topic-banner {
  border: 1px solid #c7d2fe;
  border-radius: 12px;
  background: #eef2ff;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.chat-messages {
  position: relative;
  min-height: 280px;
  max-height: 65vh;
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px;
  background: #f8fafc;
  display: grid;
  gap: 10px;
  align-content: start;
}

.chat-message {
  max-width: min(82%, 520px);
  width: fit-content;
  justify-self: start;
  background: #ffffff;
  border: 1px solid #dbe4ee;
  border-radius: 12px;
  padding: 10px;
  display: grid;
  gap: 8px;
}

.chat-message.own {
  margin-left: auto;
  justify-self: end;
  background: #e0f2fe;
  border-color: #93c5fd;
}

.chat-message.topic {
  margin: 0 auto;
  max-width: 100%;
  border-style: dashed;
  border-color: #cbd5e1;
  background: #f8fafc;
}

.chat-topic-intro {
  margin: 0;
  text-align: center;
  color: #0f172a;
}

.chat-message-text {
  margin: 0;
  white-space: pre-wrap;
}

.chat-message-time {
  color: #64748b;
  justify-self: end;
}

.chat-attachment {
  border: 1px solid #dbe4ee;
  border-radius: 8px;
  padding: 8px;
  background: #f8fafc;
  display: flex;
  gap: 12px;
  align-items: center;
  text-decoration: none;
  color: inherit;
  max-width: 100%;
}

.chat-attachment img {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 6px;
  background: #e2e8f0;
}

.chat-attachment div {
  display: flex;
  flex-direction: column;
}

.chat-composer {
  display: grid;
  gap: 8px;
}

.chat-pending-attachment {
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: #eff6ff;
  padding: 8px;
  display: grid;
}

.chat-composer-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: end;
}

.chat-composer-form textarea {
  min-height: 52px;
  resize: vertical;
}

.chat-empty-state {
  min-height: 220px;
  display: grid;
  place-items: center;
}

@media (max-width: 960px) {
  .chat-layout {
    grid-template-columns: 1fr;
  }

  .chat-main {
    min-height: 460px;
  }
}
</style>
