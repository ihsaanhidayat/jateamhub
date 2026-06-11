import { create } from 'zustand'
import {
  supabase,
  getConversations, getMessages, createConversation, sendMessage,
  uploadChatFile, markMessagesRead, markMessagesDelivered, deleteMessage,
  clearConversationMessages, toggleReaction, updateLastSeen,
  getChatEnabled, setChatEnabled as dbSetChatEnabled,
  type ChatConversation, type ChatMessage,
} from '../utils/supabaseClient'
import { hashPin, verifyPin } from '../utils/security'

const PIN_HASH_KEY  = 'jateamhub-chat-pin-hash'
const PIN_SALT_KEY  = 'jateamhub-chat-pin-salt'
const SESSION_KEY   = 'jateamhub-chat-unlocked'
const IDLE_MS       = 5 * 60 * 1000     // 5 minutes
const HEARTBEAT_MS  = 45 * 1000         // last_seen refresh cadence

interface ChatState {
  enabled:       boolean | null
  conversations: ChatConversation[]
  currentConvId: string | null
  messages:      ChatMessage[]
  unreadTotal:   number
  onlineUsers:   Record<string, boolean>   // userId → online
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
  reactToMsg:        (msgId: string, emoji: string, userId: string) => Promise<void>

  // Realtime — global channel + presence owned by App.tsx
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
let _globalChannel:   ReturnType<typeof supabase.channel> | null = null
let _convChannel:     ReturnType<typeof supabase.channel> | null = null
let _presenceChannel: ReturnType<typeof supabase.channel> | null = null
let _idleTimer:       ReturnType<typeof setTimeout>  | null = null
let _heartbeat:       ReturnType<typeof setInterval> | null = null
let _userId           = ''

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

function startHeartbeat(userId: string) {
  stopHeartbeat()
  if (document.visibilityState === 'visible') updateLastSeen(userId)
  _heartbeat = setInterval(() => {
    if (document.visibilityState === 'visible') updateLastSeen(userId)
  }, HEARTBEAT_MS)
}
function stopHeartbeat() {
  if (_heartbeat) { clearInterval(_heartbeat); _heartbeat = null }
}

function teardownRealtime() {
  stopHeartbeat()
  if (_globalChannel)   { _globalChannel.unsubscribe();   _globalChannel = null }
  if (_convChannel)     { _convChannel.unsubscribe();     _convChannel = null }
  if (_presenceChannel) { _presenceChannel.unsubscribe(); _presenceChannel = null }
}

// Write last_seen + lock session on background/close
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && _userId) updateLastSeen(_userId)
})
window.addEventListener('pagehide', () => {
  if (_userId) updateLastSeen(_userId)
  sessionStorage.removeItem(SESSION_KEY)
})

// Lock + cleanup on logout
window.addEventListener('jateamhub-logout', () => {
  sessionStorage.removeItem(SESSION_KEY)
  stopIdleTimer()
  teardownRealtime()
  _userId = ''
  useChatStore.setState({
    isLocked: true, currentConvId: null, messages: [],
    conversations: [], unreadTotal: 0, onlineUsers: {}, _realtimeSub: null,
  })
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => { stopIdleTimer(); teardownRealtime() })
}

export const useChatStore = create<ChatState>((set, get) => ({
  enabled:       null,
  conversations: [],
  currentConvId: null,
  messages:      [],
  unreadTotal:   0,
  onlineUsers:   {},
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
    if (_convChannel) { _convChannel.unsubscribe(); _convChannel = null }

    if (!id) { set({ currentConvId: null, messages: [] }); return }

    set({ currentConvId: id, msgLoading: true })
    const msgs = await getMessages(id)
    set({ messages: msgs, msgLoading: false })

    // Recipient opened the thread → mark delivered + read (drives sender's ✓✓ blue)
    if (document.visibilityState === 'visible') {
      await markMessagesDelivered(id, userId)
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

    // Per-conversation broadcast channel — instant message delivery
    _convChannel = supabase.channel(`chat-conv-${id}`, {
      config: { broadcast: { self: false, ack: false } },
    })
      .on('broadcast', { event: 'msg' }, ({ payload }) => {
        const msg = payload.msg as ChatMessage
        if (msg.sender_id === userId) return
        set(s => ({
          messages: s.messages.some(m => m.id === msg.id) ? s.messages : [...s.messages, msg],
        }))
        if (document.visibilityState === 'visible') {
          markMessagesDelivered(id, userId)
          markMessagesRead(id, userId)
        }
      })
      .on('broadcast', { event: 'del' }, ({ payload }) => {
        set(s => ({ messages: s.messages.filter(m => m.id !== payload.id) }))
      })
      .on('broadcast', { event: 'clear' }, () => set({ messages: [] }))
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
    if (conv) set(s => ({ conversations: [conv, ...s.conversations] }))
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

  reactToMsg: async (msgId, emoji, userId) => {
    // Optimistic toggle
    set(s => ({
      messages: s.messages.map(m => {
        if (m.id !== msgId) return m
        const r = { ...(m.reactions ?? {}) }
        const users = new Set(r[emoji] ?? [])
        users.has(userId) ? users.delete(userId) : users.add(userId)
        if (users.size) r[emoji] = [...users]; else delete r[emoji]
        return { ...m, reactions: r }
      }),
    }))
    get().resetIdle()
    const reactions = await toggleReaction(msgId, userId, emoji)
    if (reactions) {
      set(s => ({ messages: s.messages.map(m => m.id === msgId ? { ...m, reactions } : m) }))
    }
  },

  // ── Global realtime (unread + live status) + presence ─────────
  subscribeAll: (userId) => {
    teardownRealtime()
    _userId = userId

    _globalChannel = supabase.channel('chat-global')
      // New message inserted anywhere
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as ChatMessage
          const state = get()

          // I'm the recipient → acknowledge delivery
          if (msg.sender_id !== userId) markMessagesDelivered(msg.conversation_id, userId)

          if (state.currentConvId === msg.conversation_id) {
            if (msg.sender_id === userId) return
            set(s => ({
              messages: s.messages.some(m => m.id === msg.id) ? s.messages : [...s.messages, msg],
            }))
            if (document.visibilityState === 'visible') markMessagesRead(msg.conversation_id, userId)
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
      // Status changes: delivered_at / read_at / reactions / soft-delete
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as ChatMessage
          if (get().currentConvId !== msg.conversation_id) return
          set(s => ({
            messages: msg.deleted_at
              ? s.messages.filter(m => m.id !== msg.id)
              : s.messages.map(m => m.id === msg.id ? { ...m, ...msg } : m),
          }))
        }
      )
      .subscribe()

    // Presence — who's online right now
    _presenceChannel = supabase.channel('chat-presence', {
      config: { presence: { key: userId } },
    })
      .on('presence', { event: 'sync' }, () => {
        const raw = _presenceChannel!.presenceState()
        const online: Record<string, boolean> = {}
        Object.keys(raw).forEach(uid => { online[uid] = true })
        set({ onlineUsers: online })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await _presenceChannel!.track({ online_at: Date.now() })
      })

    startHeartbeat(userId)
    set({ _realtimeSub: () => teardownRealtime() })
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
