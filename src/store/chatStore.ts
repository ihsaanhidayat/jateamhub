import { create } from 'zustand'
import {
  supabase,
  getConversations, getMessages, createConversation, sendMessage,
  uploadChatFile, markMessagesRead, deleteMessage,
  getChatEnabled, setChatEnabled as dbSetChatEnabled,
  type ChatConversation, type ChatMessage,
} from '../utils/supabaseClient'
import { hashPin, verifyPin } from '../utils/security'

const PIN_HASH_KEY = 'jateamhub-chat-pin-hash'
const PIN_SALT_KEY = 'jateamhub-chat-pin-salt'
const SESSION_KEY  = 'jateamhub-chat-unlocked'

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

  loadEnabled:      () => Promise<void>
  setEnabled:       (v: boolean) => Promise<void>
  loadConversations: (userId: string) => Promise<void>
  selectConv:       (id: string | null, userId: string) => Promise<void>
  startConv:        (createdBy: string, participantB: string) => Promise<ChatConversation | null>
  sendText:         (text: string, senderId: string) => Promise<void>
  sendFile:         (file: File, senderId: string) => Promise<void>
  removeMsg:        (msgId: string) => Promise<void>

  // Realtime
  _realtimeSub: (() => void) | null
  subscribeAll: (userId: string) => void
  unsubscribeAll: () => void

  // Lock
  setupPin:        (pin: string) => Promise<void>
  verifyAndUnlock: (pin: string) => Promise<boolean>
  lock:            () => void
  clearPin:        () => void
}

let _channel: ReturnType<typeof supabase.channel> | null = null

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
    set({ conversations: convs, loading: false })
  },

  selectConv: async (id, userId) => {
    if (!id) { set({ currentConvId: null, messages: [] }); return }
    set({ currentConvId: id, msgLoading: true })
    const msgs = await getMessages(id)
    set({ messages: msgs, msgLoading: false })
    await markMessagesRead(id, userId)
    // Decrement unread for this conversation
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
  },

  startConv: async (createdBy, participantB) => {
    const existing = get().conversations.find(
      c => (c.participant_a === participantB || c.participant_b === participantB)
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
    const msg = await sendMessage(convId, senderId, text.trim(), 'text')
    if (msg) {
      set(s => ({
        messages: [...s.messages, msg],
        conversations: s.conversations.map(c =>
          c.id === convId ? { ...c, last_message_at: msg.created_at } : c
        ),
      }))
    }
    set({ sending: false })
  },

  sendFile: async (file, senderId) => {
    const convId = get().currentConvId
    if (!convId) return
    set({ sending: true })
    const result = await uploadChatFile(convId, file)
    if (!result) { set({ sending: false }); return }
    const type = file.type.startsWith('image/') ? 'image'
               : file.type.startsWith('video/') ? 'video'
               : file.type.startsWith('audio/') ? 'audio'
               : 'document'
    const msg = await sendMessage(convId, senderId, null, type as ChatMessage['message_type'],
      result.url, result.name, result.size)
    if (msg) {
      set(s => ({
        messages: [...s.messages, msg],
        conversations: s.conversations.map(c =>
          c.id === convId ? { ...c, last_message_at: msg.created_at } : c
        ),
      }))
    }
    set({ sending: false })
  },

  removeMsg: async (msgId) => {
    await deleteMessage(msgId)
    set(s => ({ messages: s.messages.filter(m => m.id !== msgId) }))
  },

  subscribeAll: (userId) => {
    if (_channel) { _channel.unsubscribe(); _channel = null }
    _channel = supabase.channel('chat-all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as ChatMessage
          const state = get()
          // Update messages if this conv is open
          if (state.currentConvId === msg.conversation_id) {
            set(s => ({ messages: [...s.messages, msg] }))
            // Mark read immediately if the window is focused
            if (document.hasFocus()) {
              markMessagesRead(msg.conversation_id, userId)
            }
          } else if (msg.sender_id !== userId) {
            // Increment unread for other conversations
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
    set({ _realtimeSub: () => { if (_channel) { _channel.unsubscribe(); _channel = null } } })
  },

  unsubscribeAll: () => {
    const unsub = get()._realtimeSub
    if (unsub) { unsub(); set({ _realtimeSub: null }) }
  },

  setupPin: async (pin) => {
    const salt = crypto.randomUUID()
    const hash = await hashPin(pin, salt)
    localStorage.setItem(PIN_HASH_KEY, hash)
    localStorage.setItem(PIN_SALT_KEY, salt)
    sessionStorage.setItem(SESSION_KEY, '1')
    set({ hasPinSet: true, isLocked: false })
  },

  verifyAndUnlock: async (pin) => {
    const hash = localStorage.getItem(PIN_HASH_KEY)
    const salt = localStorage.getItem(PIN_SALT_KEY)
    if (!hash || !salt) {
      sessionStorage.setItem(SESSION_KEY, '1')
      set({ isLocked: false })
      return true
    }
    const ok = await verifyPin(pin, salt, hash)
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, '1')
      set({ isLocked: false })
    }
    return ok
  },

  lock: () => {
    sessionStorage.removeItem(SESSION_KEY)
    set({ isLocked: true })
  },

  clearPin: () => {
    localStorage.removeItem(PIN_HASH_KEY)
    localStorage.removeItem(PIN_SALT_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    set({ hasPinSet: false, isLocked: true })
  },
}))

// Lock on logout
window.addEventListener('jateamhub-logout', () => {
  sessionStorage.removeItem(SESSION_KEY)
  useChatStore.setState({ isLocked: true, currentConvId: null, messages: [], conversations: [] })
  if (_channel) { _channel.unsubscribe(); _channel = null }
})
