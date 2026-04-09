<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authState } from '../services/authService'
import { getMyProducts, getProductById, getSellerById } from '../services/marketplaceService'
import {
  deleteConversationIfEmpty,
  ensureDirectConversation,
  ensureUniBrikConversation,
  getConversationMessages,
  getConversationPeer,
  getUnreadCountForUser,
  getUserConversations,
  markConversationAsRead,
  sendChatMessage,
} from '../services/chatService'

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

const isLoadingConversations = ref(false)
const isLoadingMessages = ref(false)
const isSending = ref(false)

const hasConversations = computed(() => conversations.value.length > 0)
const activeConversation = computed(
  () => conversations.value.find((conversation) => conversation.id === activeConversationId.value) || null,
)
const activePeer = computed(() => getConversationPeer(activeConversation.value, user.value?.uid || ''))
const isReadOnlyConversation = computed(() => Boolean(activeConversation.value?.readOnly))
const activeTopicProduct = computed(() => activeConversation.value?.topicProduct || null)

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
  if (!user.value) {
    conversations.value = []
    activeConversationId.value = ''
    messages.value = []
    return
  }

  isLoadingConversations.value = true
  chatError.value = ''

  try {
    conversations.value = await getUserConversations(user.value)

    if (!activeConversationId.value && conversations.value.length) {
      activeConversationId.value = conversations.value[0].id
    }
  } catch (err) {
    conversations.value = []
    activeConversationId.value = ''
    messages.value = []
    chatError.value = err instanceof Error ? err.message : 'Falha ao carregar conversas.'
  } finally {
    isLoadingConversations.value = false
  }
}

async function loadMessages() {
  if (!activeConversationId.value) {
    messages.value = []
    return
  }

  isLoadingMessages.value = true
  chatError.value = ''

  try {
    messages.value = await getConversationMessages(activeConversationId.value)

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
  } catch (err) {
    messages.value = []
    chatError.value = err instanceof Error ? err.message : 'Falha ao carregar mensagens.'
  } finally {
    isLoadingMessages.value = false
  }
}

async function ensureSystemConversationIfVendor() {
  if (!user.value) {
    return
  }

  let myProducts = []

  try {
    myProducts = await getMyProducts(user.value)
  } catch {
    return
  }

  if (!myProducts.length) {
    return
  }

  try {
    await ensureUniBrikConversation(user.value)
  } catch {
    // Falha no sistema de avisos não pode bloquear a abertura das conversas diretas.
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

  if (!sellerId || !user.value || sellerId === user.value.uid) {
    return
  }

  chatError.value = ''

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
      : existing || (await ensureDirectConversation(user.value, sellerPayload, { topicProduct }))

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

async function initializeChat() {
  if (!user.value) {
    return
  }

  chatError.value = ''

  await ensureSystemConversationIfVendor()
  await loadConversations()

  await handleProductChatIntent()

  const requestedConversation = typeof route.query.conversation === 'string' ? route.query.conversation : ''

  if (requestedConversation && conversations.value.some((item) => item.id === requestedConversation)) {
    activeConversationId.value = requestedConversation
  }

  await loadMessages()
}

onMounted(() => {
  initializeChat()
})

onBeforeUnmount(async () => {
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
            :class="{ active: conversation.id === activeConversationId }"
            @click="selectConversation(conversation.id)"
          >
            <div class="chat-conversation-head">
              <strong>{{ getConversationPeer(conversation, user?.uid || '').name }}</strong>
              <span v-if="getUnreadCount(conversation) > 0" class="chat-unread-badge">
                {{ getUnreadCount(conversation) }}
              </span>
            </div>
            <small class="muted">{{ conversation.lastMessagePreview || 'Sem mensagens' }}</small>
          </button>
        </li>
      </ul>
    </aside>

    <section class="card chat-main" v-if="hasConversations && activeConversation">
      <header class="chat-main-header">
        <h2>{{ activePeer?.name || 'Conversa' }}</h2>
        <p v-if="isReadOnlyConversation" class="muted">Conversa somente leitura.</p>
      </header>

      <div v-if="showTopicPreviewBanner" class="chat-topic-banner">
        <strong>Você está pedindo sobre:</strong>
        <span>{{ activeTopicProduct?.title }}</span>
      </div>

      <section class="chat-messages loading-section">
        <div v-if="isLoadingMessages" class="section-loading-overlay" aria-live="polite">
          <span class="spinner" aria-hidden="true"></span>
          <p>Carregando mensagens...</p>
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

            <RouterLink
              v-if="message.attachment"
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
          ></textarea>
          <button class="btn" type="submit" :disabled="isReadOnlyConversation || isSending">
            {{ isSending ? 'Enviando...' : 'Enviar' }}
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
  min-height: 420px;
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

.chat-main {
  min-height: 520px;
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
  max-height: 52vh;
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
  background: #ffffff;
  border: 1px solid #dbe4ee;
  border-radius: 12px;
  padding: 10px;
  display: grid;
  gap: 8px;
}

.chat-message.own {
  margin-left: auto;
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
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 8px;
  background: #fff;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.chat-attachment img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
  background: #e5e7eb;
}

.chat-attachment div {
  display: grid;
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
