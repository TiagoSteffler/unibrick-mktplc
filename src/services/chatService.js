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
  onSnapshot,
  orderBy,
  limit,
  startAfter,
  updateDoc
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from '../firebase/config'
import { enforceRateLimit, recordOperation } from './rateLimitService'

const CONVERSATIONS_COLLECTION = 'chat_conversations'
const UNI_BRIK_ID = 'unibrik-system'
const UNI_BRIK_NAME = 'UniBrik'

function nowIso() {
  return new Date().toISOString()
}

function normalizeTopicProduct(data) {
  if (!data || typeof data !== 'object') {
    return null
  }

  const productId = String(data.productId || '').trim()
  const title = String(data.title || '').trim()
  const buyerId = String(data.buyerId || '').trim()

  if (!productId || !title || !buyerId) {
    return null
  }

  return {
    productId,
    title,
    buyerId,
  }
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
    topicProduct: normalizeTopicProduct(data.topicProduct),
    clearedAt: data.clearedAt || {},
  }
}

function normalizeMessage(data) {
  return {
    id: String(data.id || ''),
    kind: data.kind === 'topic-intro' ? 'topic-intro' : 'text',
    conversationId: String(data.conversationId || ''),
    senderId: String(data.senderId || ''),
    senderName: String(data.senderName || ''),
    text: String(data.text || ''),
    createdAt: data.createdAt || nowIso(),
    attachment: data.attachment || null,
    topicProductId: String(data.topicProductId || ''),
    topicProductTitle: String(data.topicProductTitle || ''),
    topicBuyerId: String(data.topicBuyerId || ''),
  }
}

function getDirectConversationId(userIdA, userIdB) {
  const [first, second] = [String(userIdA), String(userIdB)].sort((a, b) => a.localeCompare(b))
  return `direct_${first}_${second}`
}

function getSystemConversationId(userId) {
  return `system_${UNI_BRIK_ID}_${String(userId)}`
}

function createDirectConversationBase(currentUser, otherUser, createdAt = nowIso(), topicProduct = null) {
  const normalizedTopic = normalizeTopicProduct(topicProduct)

  return normalizeConversation({
    id: getDirectConversationId(currentUser.uid, otherUser.id),
    type: 'direct',
    readOnly: false,
    participants: [currentUser.uid, otherUser.id],
    participantProfiles: {
      [currentUser.uid]: {
        name: currentUser.fullName || currentUser.displayName || 'Usuário',
        photoURL: '',
      },
      [otherUser.id]: {
        name: otherUser.fullName || otherUser.name || 'Vendedor',
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
    topicProduct: normalizedTopic,
  })
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

export async function clearConversationMessages(conversation, user) {
  if (!conversation?.id || !user) return

  const clearedAt = {
    ...(conversation.clearedAt || {}),
    [user.uid]: nowIso()
  }

  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, CONVERSATIONS_COLLECTION, conversation.id), { clearedAt })
  } else {
    throw new Error(UI_TEXTS.ERR_OFFLINE)
  }
}

export async function getUserConversations(user) {
  if (!user) {
    return []
  }

  if (isFirebaseConfigured && db) {
    return getConversationsFirestore(user.uid)
  }

  throw new Error(UI_TEXTS.ERR_OFFLINE)
}

export async function getConversationMessages(conversationId) {
  if (!conversationId) {
    return []
  }

  if (isFirebaseConfigured && db) {
    return getMessagesFirestore(conversationId)
  }

  throw new Error(UI_TEXTS.ERR_OFFLINE)
}

export function listenToUserConversations(user, callback) {
  if (!user) {
    callback([])
    return () => {}
  }

  if (isFirebaseConfigured && db) {
    const q = query(collection(db, CONVERSATIONS_COLLECTION), where('participants', 'array-contains', user.uid))
    return onSnapshot(q, (snapshot) => {
      const convs = snapshot.docs.map((item) =>
        normalizeConversation({
          id: item.id,
          ...item.data(),
        })
      )
      callback(sortByUpdatedAtDesc(convs))
    }, (err) => {
      console.error(err)
      callback([])
    })
  }

  throw new Error(UI_TEXTS.ERR_OFFLINE)
}

export function listenToConversationMessages(conversation, callback) {
  if (!conversation?.id) {
    callback([])
    return () => {}
  }

  const conversationId = conversation.id
  const isSystem = conversation.type === 'system'

  if (isFirebaseConfigured && db) {
    let personalMessages = []
    let broadcastMessages = []

    function mergeAndNotify() {
      const msgs = [...personalMessages, ...broadcastMessages]
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      callback(msgs)
    }

    const q = query(
      collection(db, CONVERSATIONS_COLLECTION, conversationId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(15)
    )
    const unsubPersonal = onSnapshot(q, (snapshot) => {
      personalMessages = snapshot.docs.map((item) =>
        normalizeMessage({
          id: item.id,
          conversationId,
          ...item.data(),
        })
      )
      mergeAndNotify()
    }, (err) => {
      console.error(err)
      callback([])
    })

    let unsubBroadcasts = () => {}
    if (isSystem) {
      const qBroadcast = query(
        collection(db, 'unibrik_broadcasts'),
        orderBy('createdAt', 'desc'),
        limit(15)
      )
      unsubBroadcasts = onSnapshot(qBroadcast, (snapshot) => {
        broadcastMessages = snapshot.docs.map((item) =>
          normalizeMessage({
            id: item.id,
            conversationId,
            senderId: UNI_BRIK_ID,
            senderName: UNI_BRIK_NAME,
            ...item.data(),
          })
        )
        mergeAndNotify()
      }, (err) => {
        console.error(err)
      })
    }

    return () => {
      unsubPersonal()
      unsubBroadcasts()
    }
  }

  throw new Error(UI_TEXTS.ERR_OFFLINE)
}

export async function loadPreviousMessages(conversation, lastLoadedMessageCreatedAt) {
  if (!conversation?.id || !lastLoadedMessageCreatedAt) return []

  const conversationId = conversation.id
  const isSystem = conversation.type === 'system'
  const targetTime = typeof lastLoadedMessageCreatedAt === 'object' ? lastLoadedMessageCreatedAt : new Date(lastLoadedMessageCreatedAt)

  if (isFirebaseConfigured && db) {
    let personalMessages = []
    let broadcastMessages = []

    const q = query(
      collection(db, CONVERSATIONS_COLLECTION, conversationId, 'messages'),
      orderBy('createdAt', 'desc'),
      startAfter(targetTime.toISOString()),
      limit(15)
    )
    const snapshot = await getDocs(q)
    personalMessages = snapshot.docs.map((item) =>
      normalizeMessage({
        id: item.id,
        conversationId,
        ...item.data(),
      })
    )

    if (isSystem) {
      const qBroadcast = query(
        collection(db, 'unibrik_broadcasts'),
        orderBy('createdAt', 'desc'),
        startAfter(targetTime.toISOString()),
        limit(15)
      )
      const snapBroadcast = await getDocs(qBroadcast)
      broadcastMessages = snapBroadcast.docs.map((item) =>
        normalizeMessage({
          id: item.id,
          conversationId,
          senderId: UNI_BRIK_ID,
          senderName: UNI_BRIK_NAME,
          ...item.data(),
        })
      )
    }

    const msgs = [...personalMessages, ...broadcastMessages]
    msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return msgs
  }

  throw new Error(UI_TEXTS.ERR_OFFLINE)
}

export async function ensureDirectConversation(currentUser, otherUser, options = {}) {
  if (!currentUser || !otherUser?.id) {
    throw new Error(UI_TEXTS.ERR_CHAT_INVALID_DATA)
  }

  enforceRateLimit('createConversation')

  const topicProduct = normalizeTopicProduct(options.topicProduct)
  const baseConversation = createDirectConversationBase(currentUser, otherUser, nowIso(), topicProduct)
  const conversationId = baseConversation.id

  if (isFirebaseConfigured && db) {
    const reference = doc(db, CONVERSATIONS_COLLECTION, conversationId)
    const snapshot = await getDoc(reference)

    if (!snapshot.exists()) {
      await setDoc(reference, baseConversation)
      recordOperation('createConversation')
      return baseConversation
    }

    const existingConversation = normalizeConversation({
      id: snapshot.id,
      ...snapshot.data(),
    })

    if (topicProduct && !existingConversation.topicProduct) {
      await setDoc(reference, { topicProduct }, { merge: true })
      return normalizeConversation({
        ...existingConversation,
        topicProduct,
      })
    }

    return existingConversation
  }

  throw new Error(UI_TEXTS.ERR_OFFLINE)
}

export function buildDirectConversationDraft(currentUser, otherUser, options = {}) {
  if (!currentUser || !otherUser?.id) {
    throw new Error(UI_TEXTS.ERR_CHAT_INVALID_DATA)
  }

  if (currentUser.uid === otherUser.id) {
    throw new Error(UI_TEXTS.ERR_CHAT_SELF)
  }

  const topicProduct = normalizeTopicProduct(options.topicProduct)
  return createDirectConversationBase(currentUser, otherUser, nowIso(), topicProduct)
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

  throw new Error(UI_TEXTS.ERR_OFFLINE)
}

export async function sendSystemBroadcast(adminUser, text) {
  if (!adminUser || !text) return

  const payload = {
    text,
    senderId: UNI_BRIK_ID,
    senderName: UNI_BRIK_NAME,
    createdAt: nowIso(),
    kind: 'text',
  }

  if (isFirebaseConfigured && db) {
    await addDoc(collection(db, 'unibrik_broadcasts'), payload)
  } else {
    throw new Error(UI_TEXTS.ERR_OFFLINE)
  }
}

export async function sendSystemMessageToUser(targetUserId, text, topicProduct = null) {
  if (!targetUserId || !text) return
  
  const conversationId = getSystemConversationId(targetUserId)
  const payload = {
    text,
    senderId: UNI_BRIK_ID,
    senderName: UNI_BRIK_NAME,
    createdAt: nowIso(),
    kind: 'text',
  }
  if (topicProduct) {
    payload.attachment = {
      productId: topicProduct.productId,
      title: topicProduct.title,
      price: topicProduct.price,
      photo: topicProduct.photo,
    }
  }

  if (isFirebaseConfigured && db) {
    await addDoc(collection(db, CONVERSATIONS_COLLECTION, conversationId, 'messages'), payload)
    await setDoc(doc(db, CONVERSATIONS_COLLECTION, conversationId), {
      lastMessagePreview: text.substring(0, 50),
      updatedAt: nowIso()
    }, { merge: true })
  } else {
    throw new Error(UI_TEXTS.ERR_OFFLINE)
  }
}

export async function ensureUniBrikConversation(user) {
  if (!user) {
    return null
  }

  const conversationId = getSystemConversationId(user.uid)
  const messageText = 'Canal de avisos da UniBrik.'

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
      [user.uid]: 0,
      [UNI_BRIK_ID]: 0,
    },
  })

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

  throw new Error(UI_TEXTS.ERR_OFFLINE)
}

export async function sendChatMessage(user, conversation, payload) {
  if (!user) {
    throw new Error(UI_TEXTS.ERR_CHAT_UNAUTHENTICATED)
  }

  if (!conversation?.id) {
    throw new Error(UI_TEXTS.ERR_CHAT_INVALID_CONVERSATION)
  }

  if (conversation.readOnly) {
    throw new Error(UI_TEXTS.ERR_CHAT_READ_ONLY)
  }

  enforceRateLimit('sendMessage')

  const text = String(payload?.text || '').trim()
  const attachment = payload?.attachment || null

  if (!text && !attachment) {
    throw new Error(UI_TEXTS.ERR_CHAT_EMPTY_MESSAGE)
  }

  const createdAt = nowIso()
  const topicIntro = normalizeTopicProduct(payload?.topicIntro)
  const shouldCreateTopicIntro = Boolean(topicIntro && topicIntro.buyerId === user.uid)
  const topicCreatedAt = shouldCreateTopicIntro
    ? new Date(new Date(createdAt).getTime() - 1).toISOString()
    : ''

  const topicMessage = shouldCreateTopicIntro
    ? normalizeMessage({
        id: `topic-${Date.now()}`,
        kind: 'topic-intro',
        conversationId: conversation.id,
        senderId: topicIntro.buyerId,
        senderName: user.displayName || 'Usuário',
        text: '',
        attachment: null,
        createdAt: topicCreatedAt,
        topicProductId: topicIntro.productId,
        topicProductTitle: topicIntro.title,
        topicBuyerId: topicIntro.buyerId,
      })
    : null

  const message = normalizeMessage({
    id: `msg-${Date.now()}`,
    conversationId: conversation.id,
    senderId: user.uid,
    senderName: user.displayName || 'Usuário',
    text,
    attachment,
    createdAt,
  })

  const preview = text || (attachment ? `Anúncio anexado: ${attachment.title}` : 'Nova mensagem')

  const updatedConversation = normalizeConversation({
    ...conversation,
    topicProduct: conversation.topicProduct || topicIntro || null,
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

    if (topicMessage) {
      await addDoc(collection(db, CONVERSATIONS_COLLECTION, conversation.id, 'messages'), {
        kind: topicMessage.kind,
        senderId: topicMessage.senderId,
        senderName: topicMessage.senderName,
        text: topicMessage.text,
        createdAt: topicMessage.createdAt,
        attachment: topicMessage.attachment,
        topicProductId: topicMessage.topicProductId,
        topicProductTitle: topicMessage.topicProductTitle,
        topicBuyerId: topicMessage.topicBuyerId,
      })
    }

    await addDoc(collection(db, CONVERSATIONS_COLLECTION, conversation.id, 'messages'), {
      kind: message.kind,
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text,
      createdAt: message.createdAt,
      attachment: message.attachment,
      topicProductId: message.topicProductId,
      topicProductTitle: message.topicProductTitle,
      topicBuyerId: message.topicBuyerId,
    })

    recordOperation('sendMessage')
    return message
  }

  throw new Error(UI_TEXTS.ERR_OFFLINE)
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
    name: profile.name || 'Usuário',
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
  } else {
    throw new Error(UI_TEXTS.ERR_OFFLINE)
  }
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
  } else {
    throw new Error(UI_TEXTS.ERR_OFFLINE)
  }
}

export async function markProductConversationsAsDeleted(productId) {
  if (!productId) return

  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, CONVERSATIONS_COLLECTION), where('topicProduct.productId', '==', String(productId)))
      const snapshot = await getDocs(q)
      const updates = snapshot.docs.map(docSnap => 
        setDoc(docSnap.ref, { topicProduct: { deleted: true } }, { merge: true })
      )
      await Promise.all(updates)
    } catch (e) {
      console.warn('Falha ao atualizar conversas do produto apagado', e)
    }
  } else {
    throw new Error(UI_TEXTS.ERR_OFFLINE)
  }
}
