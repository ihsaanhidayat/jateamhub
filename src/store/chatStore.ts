import { create } from 'zustand'
import {
  supabase,
  getConversations, getMessages, createConversation, sendMessage,
  uploadChatFile, markMessagesRead, deleteMessage, clearConversationMessages,
  getChatEnabled, setChatEnabled as dbSetChatEnabled,
  type ChatConversation, type ChatMessage,
} from '../utils/supabaseClient'
import { hashPin, verifyPin } from '../utils/security'

const PIN_HASH_KEY  = 'jateamhub-chat-pin-hash'
const PIN_SALT_KEY  = 'jateamhub-chat-pin-salt'
const SESSION_KEY   = 'jateamhub-chat-unlocked'
const IDLE_MS       = 5 * 60 * 1000   // 5 minutes

interface ChatState {
  enabled:       boolean | null
  conversations: ChatConversation[]
  currentConvId: string | null
  messages:      ChatMessage[]
  unreadTotal:   number
  loading:       boolean
  msgLoading:    boolean
  sending:       boolean
  isLocked:      boolean
  hasPinSet:     boolean

  loadEnabled:       () => Promise<void>
  setEnabled:        (v: boolean) => Promise<void>
  loadConversations: (userId: string) => Promise<void>
  selectConv:        (id: string | null, userId: string) => Promise<void>
  closeConvChannel:  () => void
  startConv:         (createdBy: string, participantB: string) => Promise<ChatConversation | null>
  sendText:          (text: string, senderId: string) => Promise<void>
  sendFile:          (file: File, senderId: string) => Promise<void>
  removeMsg:         (msgId: string) => Promise<void>
  clearConv:         () => Promise<void>

  // Realtime — global channel owned by App.tsx
  _realtimeSub: (() => void) | null
  subscribeAll:   (userId: string) => void
  unsubscribeAll: () => void

  // Idle timer
  resetIdle:  () => void
  stopIdle:   () => void

  // Lock
  setupPin:        (pin: string) => Promise<void>
  verifyAndUnlock: (pin: string) => Promise<boolean>
  lock:            () => void
  clearPin:        () => void
}

// Module-level channels — survive re-renders, cleaned up on logout
let _globalChannel: ReturnType<typeof supabase.channel> | null = null
let _convChannel:   ReturnType<typeof supabase.channel> | null = null
let _idleTimer:     ReturnType<typeof setTimeout>       | null = null
let _userId         = ''

function resetIdleTimer() {
  if (_idleTimer) clearTimeout(_idleTimer)
  _idleTimer = setTimeout(() => {
    const { isLocked, lock } = useChatStore.getState()
    if (!isLocked) lock()
  }, IDLE_MS)
}

function stopIdleTimer() {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null }
}

// Lock on page close/navigation — clear session unlock
window.addEventListener('pagehide', () => {
  sessionStorage.removeItem(SESSION_KEY)
})

// Lock on logout
window.addEventListener('jateamhub-logout', () => {
  sessionStorage.removeItem(SESSION_KEY)
  stopIdleTimer()
  if (_globalChannel) { _globalChannel.unsubscribe(); _globalChannel = null }
  if (_convChannel)   { _convChannel.unsubscribe();   _convChannel = null }
  _userId = ''
  useChatStore.setState({
    isLocked: true, currentConvId: null, messages: [],
    conversations: [], unreadTotal: 0, _realtimeSub: null,
  })
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopIdleTimer()
    if (_globalChannel) { _globalChannel.unsubscribe(); _globalChannel = null }
    if (_convChannel)   { _convChannel.unsubscribe();   _convChannel = null }
  })
}

export const useChatStore = create<ChatState>((set, get) => ({
  enabled:       null,
  conversations: [],
  currentConvId: null,
  messages:      [],
  unreadTotal:   0,
  loading:       false,
  msgLoading:    false,
  sending:       false,
  isLocked:      !sessionStorage.getItem(SESSION_KEY),
  hasPinSet:     !!localStorage.getItem(PIN_HASH_KEY),
  _realtimeSub:  null,

  loadEnabled: async () => {
    const v = await getChatEnabled()
    set({ enabled: v })
  },

  setEnabled: async (v) => {
    await dbSetChatEnabled(v)
    set({ enabled: v })
  },

  loadConversations: async (userId) => {
    set({ loading: true })
    const convs = await getConversations(userId)
    const total = convs.reduce((sum, c) => sum + (c.unread_count ?? 0), 0)
    set({ conversations: convs, loading: false, unreadTotal: total })
  },

  selectConv: async (id, userId) => {
    // Tear down previous conversation broadcast channel
    if (_convChannel) { _convChannel.unsubscribe(); _convChannel = null }

    if (!id) { set({ currentConvId: null, messages: [] }); return }

    set({ currentConvId: id, msgLoading: true })
    const msgs = await getMessages(id)
    set({ messages: msgs, msgLoading: false })

    if (document.visibilityState === 'visible') {
      await markMessagesRead(id, userId)
      set(s => {
        const conv = s.conversations.find(c => c.id === id)
        const wasUnread = conv?.unread_count ?? 0
        return {
          unreadTotal: Math.max(0, s.unreadTotal - wasUnread),
          conversations: s.conversations.map(c =>
            c.id === id ? { ...c, unread_count: 0 } : c
          ),
        }
      })
    }

    // Subscribe to per-conversation broadcast channel for instant delivery
    _convChannel = supabase.channel(`chat-conv-${id}`, {
      config: { broadcast: { self: false, ack: false } },
    })
      .on('broadcast', { event: 'msg' }, ({ payload }) => {
        const msg = payload.msg as ChatMessage
        // Skip own messages (already added optimistically)
        if (msg.sender_id === userId) return
        set(s => ({
          messages: s.messages.some(m => m.id === msg.id) ? s.messages : [...s.messages, msg],
        }))
        if (document.visibilityState === 'visible') {
          markMessagesRead(id, userId)
        }
      })
      .on('broadcast', { event: 'del' }, ({ payload }) => {
        set(s => ({ messages: s.messages.filter(m => m.id !== payload.id) }))
      })
      .on('broadcast', { event: 'clear' }, () => {
        set({ messages: [] })
      })
      .subscribe()
  },

  closeConvChannel: () => {
    if (_convChannel) { _convChannel.unsubscribe(); _convChannel = null }
    set({ currentConvId: null, messages: [] })
  },

  startConv: async (createdBy, participantB) => {
    const existing = get().conversations.find(c =>
      (c.participant_a === createdBy && c.participant_b === participantB) ||
      (c.participant_b === createdBy && c.participant_a === participantB)
    )
    if (existing) return existing
    const conv = await createConversation(createdBy, participantB)
    if (conv) {
      set(s => ({ conversations: [conv, ...s.conversations] }))
    }
    return conv
  },

  sendText: async (text, senderId) => {
    const convId = get().currentConvId
    if (!convId || !text.trim()) return
    set({ sending: true })
    get().resetIdle()
    const msg = await sendMessage(convId, senderId, text.trim(), 'text')
    if (msg) {
      set(s => ({
        messages: s.messages.some(m => m.id === msg.id) ? s.messages : [...s.messages, msg],
        conversations: s.conversations.map(c =>
          c.id === convId ? { ...c, last_message_at: msg.created_at } : c
        ),
      }))
      // Broadcast for instant delivery to other participant
      _convChannel?.send({ type: 'broadcast', event: 'msg', payload: { msg } })
    }
    set({ sending: false })
  },

  sendFile: async (file, senderId) => {
    const convId = get().currentConvId
    if (!convId) return
    set({ sending: true })
    get().resetIdle()
    const result = await uploadChatFile(convId, file)
    if (!result) { set({ sending: false }); return }
    const type: ChatMessage['message_type'] =
      file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio'
      : 'document'
    const msg = await sendMessage(convId, senderId, null, type, result.url, result.name, result.size)
    if (msg) {
      set(s => ({
        messages: s.messages.some(m => m.id === msg.id) ? s.messages : [...s.messages, msg],
        conversations: s.conversations.map(c =>
          c.id === convId ? { ...c, last_message_at: msg.created_at } : c
        ),
      }))
      _convChannel?.send({ type: 'broadcast', event: 'msg', payload: { msg } })
    }
    set({ sending: false })
  },

  removeMsg: async (msgId) => {
    await deleteMessage(msgId)
    set(s => ({ messages: s.messages.filter(m => m.id !== msgId) }))
    _convChannel?.send({ type: 'broadcast', event: 'del', payload: { id: msgId } })
  },

  clearConv: async () => {
    const convId = get().currentConvId
    if (!convId) return
    await clearConversationMessages(convId)
    set({ messages: [] })
    _convChannel?.send({ type: 'broadcast', event: 'clear', payload: {} })
  },

  // ── Global realtime (unread badge) — owned by App.tsx ─────
  subscribeAll: (userId) => {
    if (_globalChannel) { _globalChannel.unsubscribe(); _globalChannel = null }
    _userId = userId

    _globalChannel = supabase.channel('chat-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as ChatMessage
          const state = get()

          if (state.currentConvId === msg.conversation_id) {
            // Broadcast already handles this conversation — deduplicate here
            if (msg.sender_id === userId) return
            set(s => ({
              messages: s.messages.some(m => m.id === msg.id) ? s.messages : [...s.messages, msg],
            }))
            if (document.visibilityState === 'visible') {
              markMessagesRead(msg.conversation_id, userId)
            }
          } else if (msg.sender_id !== userId) {
            set(s => ({
              unreadTotal: s.unreadTotal + 1,
              conversations: s.conversations.map(c =>
                c.id === msg.conversation_id
                  ? { ...c, unread_count: (c.unread_count ?? 0) + 1, last_message_at: msg.created_at }
                  : c
              ),
            }))
          }
        }
      )
      .subscribe()

    set({ _realtimeSub: () => { if (_globalChannel) { _globalChannel.unsubscribe(); _globalChannel = null } } })
  },

  unsubscribeAll: () => {
    const unsub = get()._realtimeSub
    if (unsub) { unsub(); set({ _realtimeSub: null }) }
  },

  // ── Idle timer ────────────────────────────────────────────
  resetIdle: () => { if (!get().isLocked) resetIdleTimer() },
  stopIdle:  () => stopIdleTimer(),

  // ── Lock ──────────────────────────────────────────────────
  setupPin: async (pin) => {
    const salt = crypto.randomUUID()
    const hash = await hashPin(pin, salt)
    localStorage.setItem(PIN_HASH_KEY, hash)
    localStorage.setItem(PIN_SALT_KEY, salt)
    sessionStorage.setItem(SESSION_KEY, '1')
    set({ hasPinSet: true, isLocked: false })
    resetIdleTimer()
  },

  verifyAndUnlock: async (pin) => {
    const hash = localStorage.getItem(PIN_HASH_KEY)
    const salt = localStorage.getItem(PIN_SALT_KEY)
    if (!hash || !salt) {
      localStorage.removeItem(PIN_HASH_KEY)
      localStorage.removeItem(PIN_SALT_KEY)
      set({ hasPinSet: false })
      return false
    }
    const ok = await verifyPin(pin, salt, hash)
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, '1')
      set({ isLocked: false })
      resetIdleTimer()
    }
    return ok
  },

  lock: () => {
    sessionStorage.removeItem(SESSION_KEY)
    stopIdleTimer()
    set({ isLocked: true })
  },

  clearPin: () => {
    localStorage.removeItem(PIN_HASH_KEY)
    localStorage.removeItem(PIN_SALT_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    stopIdleTimer()
    set({ hasPinSet: false, isLocked: true })
  },
}))
