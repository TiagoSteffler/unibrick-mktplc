import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  addDoc,
  deleteDoc,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'

const CHAT_CONVERSATIONS_KEY = 'marketplace_chat_conversations'
const CHAT_MESSAGES_KEY = 'marketplace_chat_messages'
const CONVERSATIONS_COLLECTION = 'chat_conversations'
const UNI_BRIK_ID = 'unibrik-system'
const UNI_BRIK_NAME = 'UniBrik'

function safeRead(key, fallback) {
  const raw = localStorage.getItem(key)

  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(key)
    return fallback
  }
}

function safeWrite(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeConversation(data) {
  return {
    id: String(data.id || ''),
    type: data.type || 'direct',
    readOnly: Boolean(data.readOnly),
    participants: Array.isArray(data.participants) ? data.participants : [],
    participantProfiles: data.participantProfiles || {},
    title: String(data.title || ''),
    createdAt: data.createdAt || nowIso(),
    updatedAt: data.updatedAt || nowIso(),
    lastMessagePreview: String(data.lastMessagePreview || ''),
    unreadCounts: typeof data.unreadCounts === 'object' && data.unreadCounts ? data.unreadCounts : {},
  }
}

function normalizeMessage(data) {
  return {
    id: String(data.id || ''),
    conversationId: String(data.conversationId || ''),
    senderId: String(data.senderId || ''),
    senderName: String(data.senderName || ''),
    text: String(data.text || ''),
    createdAt: data.createdAt || nowIso(),
    attachment: data.attachment || null,
  }
}

function getDirectConversationId(userIdA, userIdB) {
  const [first, second] = [String(userIdA), String(userIdB)].sort((a, b) => a.localeCompare(b))
  return `direct_${first}_${second}`
}

function getSystemConversationId(userId) {
  return `system_${UNI_BRIK_ID}_${String(userId)}`
}

function createDirectConversationBase(currentUser, otherUser, createdAt = nowIso()) {
  return normalizeConversation({
    id: getDirectConversationId(currentUser.uid, otherUser.id),
    type: 'direct',
    readOnly: false,
    participants: [currentUser.uid, otherUser.id],
    participantProfiles: {
      [currentUser.uid]: {
        name: currentUser.displayName || 'Usuario',
        photoURL: currentUser.photoURL || '',
      },
      [otherUser.id]: {
        name: otherUser.name || 'Vendedor',
        photoURL: otherUser.photoURL || '',
      },
    },
    createdAt,
    updatedAt: createdAt,
    lastMessagePreview: '',
    unreadCounts: {
      [currentUser.uid]: 0,
      [otherUser.id]: 0,
    },
  })
}

function readConversationsLocal() {
  const conversations = safeRead(CHAT_CONVERSATIONS_KEY, [])
  return Array.isArray(conversations) ? conversations.map(normalizeConversation) : []
}

function saveConversationsLocal(conversations) {
  safeWrite(CHAT_CONVERSATIONS_KEY, conversations)
}

function readMessagesLocal() {
  const map = safeRead(CHAT_MESSAGES_KEY, {})
  return typeof map === 'object' && map ? map : {}
}

function saveMessagesLocal(messagesMap) {
  safeWrite(CHAT_MESSAGES_KEY, messagesMap)
}

function sortByUpdatedAtDesc(items) {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

async function getConversationsFirestore(userId) {
  const snapshot = await getDocs(
    query(collection(db, CONVERSATIONS_COLLECTION), where('participants', 'array-contains', userId)),
  )

  return sortByUpdatedAtDesc(
    snapshot.docs.map((item) =>
      normalizeConversation({
        id: item.id,
        ...item.data(),
      }),
    ),
  )
}

async function getMessagesFirestore(conversationId) {
  const snapshot = await getDocs(collection(db, CONVERSATIONS_COLLECTION, conversationId, 'messages'))

  const messages = snapshot.docs.map((item) =>
    normalizeMessage({
      id: item.id,
      conversationId,
      ...item.data(),
    }),
  )

  return messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

async function cleanupConversationForUserFirestore(userId, conversation) {
  const participants = Array.isArray(conversation?.participants)
    ? conversation.participants.filter((participantId) => participantId !== userId)
    : []

  const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversation.id)

  if (!participants.length) {
    await deleteDoc(conversationRef)
    return
  }

  const nextUnreadCounts = { ...(conversation.unreadCounts || {}) }
  delete nextUnreadCounts[userId]

  await setDoc(
    conversationRef,
    {
      participants,
      unreadCounts: nextUnreadCounts,
      updatedAt: nowIso(),
    },
    { merge: true },
  )
}

function upsertConversationLocal(conversation) {
  const conversations = readConversationsLocal()
  const index = conversations.findIndex((item) => item.id === conversation.id)

  if (index >= 0) {
    conversations[index] = normalizeConversation(conversation)
  } else {
    conversations.push(normalizeConversation(conversation))
  }

  saveConversationsLocal(conversations)
}

function pushMessageLocal(conversationId, message) {
  const messagesMap = readMessagesLocal()
  const current = Array.isArray(messagesMap[conversationId]) ? messagesMap[conversationId] : []

  messagesMap[conversationId] = [...current, normalizeMessage(message)]
  saveMessagesLocal(messagesMap)
}

export async function getUserConversations(user) {
  if (!user) {
    return []
  }

  if (isFirebaseConfigured && db) {
    return getConversationsFirestore(user.uid)
  }

  const conversations = readConversationsLocal().filter((item) => item.participants.includes(user.uid))
  return sortByUpdatedAtDesc(conversations)
}

export async function getConversationMessages(conversationId) {
  if (!conversationId) {
    return []
  }

  if (isFirebaseConfigured && db) {
    return getMessagesFirestore(conversationId)
  }

  const messagesMap = readMessagesLocal()
  const messages = Array.isArray(messagesMap[conversationId]) ? messagesMap[conversationId] : []
  return messages.map(normalizeMessage).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export async function ensureDirectConversation(currentUser, otherUser) {
  if (!currentUser || !otherUser?.id) {
    throw new Error('Dados de conversa invalidos.')
  }

  const baseConversation = createDirectConversationBase(currentUser, otherUser)
  const conversationId = baseConversation.id

  if (isFirebaseConfigured && db) {
    const reference = doc(db, CONVERSATIONS_COLLECTION, conversationId)
    const snapshot = await getDoc(reference)

    if (!snapshot.exists()) {
      await setDoc(reference, baseConversation)
      return baseConversation
    }

    return normalizeConversation({
      id: snapshot.id,
      ...snapshot.data(),
    })
  }

  const conversations = readConversationsLocal()
  const existing = conversations.find((item) => item.id === conversationId)

  if (existing) {
    return normalizeConversation(existing)
  }

  conversations.push(baseConversation)
  saveConversationsLocal(conversations)
  return baseConversation
}

export function buildDirectConversationDraft(currentUser, otherUser) {
  if (!currentUser || !otherUser?.id) {
    throw new Error('Dados de conversa invalidos.')
  }

  return createDirectConversationBase(currentUser, otherUser)
}

export async function deleteConversationIfEmpty(conversationId) {
  if (!conversationId) {
    return false
  }

  if (isFirebaseConfigured && db) {
    const reference = doc(db, CONVERSATIONS_COLLECTION, conversationId)
    const snapshot = await getDoc(reference)

    if (!snapshot.exists()) {
      return false
    }

    const messagesSnapshot = await getDocs(collection(db, CONVERSATIONS_COLLECTION, conversationId, 'messages'))

    if (!messagesSnapshot.empty) {
      return false
    }

    await deleteDoc(reference)
    return true
  }

  const messagesMap = readMessagesLocal()
  const existingMessages = Array.isArray(messagesMap[conversationId]) ? messagesMap[conversationId] : []

  if (existingMessages.length > 0) {
    return false
  }

  const conversations = readConversationsLocal().filter((conversation) => conversation.id !== conversationId)
  saveConversationsLocal(conversations)

  delete messagesMap[conversationId]
  saveMessagesLocal(messagesMap)

  return true
}

export async function ensureUniBrikConversation(user) {
  if (!user) {
    return null
  }

  const conversationId = getSystemConversationId(user.uid)
  const messageText = 'UniBrik: Suas atualizacoes de anuncios aparecerao por aqui.'

  const baseConversation = normalizeConversation({
    id: conversationId,
    type: 'system',
    readOnly: true,
    title: UNI_BRIK_NAME,
    participants: [user.uid, UNI_BRIK_ID],
    participantProfiles: {
      [UNI_BRIK_ID]: {
        name: UNI_BRIK_NAME,
        photoURL: '',
      },
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastMessagePreview: messageText,
    unreadCounts: {
      [user.uid]: 1,
      [UNI_BRIK_ID]: 0,
    },
  })

  const systemMessage = normalizeMessage({
    id: `system-${Date.now()}`,
    conversationId,
    senderId: UNI_BRIK_ID,
    senderName: UNI_BRIK_NAME,
    text: messageText,
    createdAt: nowIso(),
  })

  if (isFirebaseConfigured && db) {
    const reference = doc(db, CONVERSATIONS_COLLECTION, conversationId)
    const snapshot = await getDoc(reference)

    if (!snapshot.exists()) {
      await setDoc(reference, baseConversation)
      await addDoc(collection(db, CONVERSATIONS_COLLECTION, conversationId, 'messages'), {
        senderId: UNI_BRIK_ID,
        senderName: UNI_BRIK_NAME,
        text: messageText,
        createdAt: systemMessage.createdAt,
        attachment: null,
      })
      return baseConversation
    }

    return normalizeConversation({
      id: snapshot.id,
      ...snapshot.data(),
    })
  }

  const conversations = readConversationsLocal()
  const existing = conversations.find((item) => item.id === conversationId)

  if (!existing) {
    conversations.push(baseConversation)
    saveConversationsLocal(conversations)

    const messagesMap = readMessagesLocal()
    messagesMap[conversationId] = [systemMessage]
    saveMessagesLocal(messagesMap)

    return baseConversation
  }

  return normalizeConversation(existing)
}

export async function sendChatMessage(user, conversation, payload) {
  if (!user) {
    throw new Error('Usuario nao autenticado.')
  }

  if (!conversation?.id) {
    throw new Error('Conversa invalida.')
  }

  if (conversation.readOnly) {
    throw new Error('Esta conversa e somente leitura.')
  }

  const text = String(payload?.text || '').trim()
  const attachment = payload?.attachment || null

  if (!text && !attachment) {
    throw new Error('Digite uma mensagem para enviar.')
  }

  const createdAt = nowIso()
  const message = normalizeMessage({
    id: `msg-${Date.now()}`,
    conversationId: conversation.id,
    senderId: user.uid,
    senderName: user.displayName || 'Usuario',
    text,
    attachment,
    createdAt,
  })

  const preview = text || (attachment ? `Anuncio anexado: ${attachment.title}` : 'Nova mensagem')

  const updatedConversation = normalizeConversation({
    ...conversation,
    updatedAt: createdAt,
    lastMessagePreview: preview,
    unreadCounts: {
      ...(conversation.unreadCounts || {}),
      ...Object.fromEntries(
        (conversation.participants || []).map((participantId) => {
          const currentUnread = Number(conversation.unreadCounts?.[participantId] || 0)
          return [participantId, participantId === user.uid ? 0 : currentUnread + 1]
        }),
      ),
    },
  })

  if (isFirebaseConfigured && db) {
    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversation.id)

    await setDoc(
      conversationRef,
      {
        ...updatedConversation,
      },
      { merge: true },
    )

    await addDoc(collection(db, CONVERSATIONS_COLLECTION, conversation.id, 'messages'), {
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text,
      createdAt: message.createdAt,
      attachment: message.attachment,
    })

    return message
  }

  upsertConversationLocal(updatedConversation)
  pushMessageLocal(conversation.id, message)

  return message
}

export function getConversationPeer(conversation, currentUserId) {
  if (!conversation) {
    return null
  }

  if (conversation.type === 'system') {
    return {
      id: UNI_BRIK_ID,
      name: UNI_BRIK_NAME,
      photoURL: '',
    }
  }

  const otherId = (conversation.participants || []).find((participantId) => participantId !== currentUserId)

  if (!otherId) {
    return {
      id: currentUserId,
      name: 'Conversa',
      photoURL: '',
    }
  }

  const profile = conversation.participantProfiles?.[otherId] || {}

  return {
    id: otherId,
    name: profile.name || 'Usuario',
    photoURL: profile.photoURL || '',
  }
}

export function getUnreadCountForUser(conversation, userId) {
  if (!conversation || !userId) {
    return 0
  }

  return Number(conversation.unreadCounts?.[userId] || 0)
}

export async function markConversationAsRead(user, conversation) {
  if (!user?.uid || !conversation?.id) {
    return
  }

  const currentUnread = Number(conversation.unreadCounts?.[user.uid] || 0)

  if (currentUnread <= 0) {
    return
  }

  const nextConversation = normalizeConversation({
    ...conversation,
    unreadCounts: {
      ...(conversation.unreadCounts || {}),
      [user.uid]: 0,
    },
  })

  if (isFirebaseConfigured && db) {
    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversation.id)
    await setDoc(conversationRef, { unreadCounts: nextConversation.unreadCounts }, { merge: true })
    return
  }

  upsertConversationLocal(nextConversation)
}

export async function deleteUserChatData(user) {
  if (!user?.uid) {
    return
  }

  if (isFirebaseConfigured && db) {
    const conversations = await getConversationsFirestore(user.uid)

    for (const conversation of conversations) {
      await cleanupConversationForUserFirestore(user.uid, conversation)
    }

    return
  }

  const conversations = readConversationsLocal()
  const removedConversationIds = conversations
    .filter((conversation) => (conversation.participants || []).includes(user.uid))
    .map((conversation) => conversation.id)

  if (!removedConversationIds.length) {
    return
  }

  const nextConversations = conversations.filter(
    (conversation) => !(conversation.participants || []).includes(user.uid),
  )
  saveConversationsLocal(nextConversations)

  const messagesMap = readMessagesLocal()

  removedConversationIds.forEach((conversationId) => {
    delete messagesMap[conversationId]
  })

  saveMessagesLocal(messagesMap)
}
