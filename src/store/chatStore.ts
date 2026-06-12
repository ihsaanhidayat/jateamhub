import { create } from 'zustand'
import {
  supabase,
  getConversations, getMessages, createConversation, sendMessage,
  uploadChatFile, markMessagesRead, markMessagesDelivered, deleteMessage, editMessage,
  clearConversationMessages, toggleReaction, updateLastSeen,
  getChatEnabled, setChatEnabled as dbSetChatEnabled,
  type ChatConversation, type ChatMessage,
} from '../utils/supabaseClient'
import { hashPin, verifyPin } from '../utils/security'
import { playPing, showMessageNotification } from '../utils/notify'
import {
  initKeysOnUnlock, clearCryptoSession, getConvKey, encryptText, decryptText,
} from '../utils/chatCrypto'
import { messagePreview } from '../utils/chatText'

// Short preview text for a notification body.
function previewOf(msg: ChatMessage): string {
  if (msg.message_type === 'image')    return '📷 Foto'
  if (msg.message_type === 'video')    return '🎬 Video'
  if (msg.message_type === 'audio')    return '🎵 Pesan suara'
  if (msg.message_type === 'document') return '📎 ' + (msg.file_name ?? 'Dokumen')
  return msg.content ?? ''
}

// The other participant of a conversation, relative to me.
function partnerOf(conv: ChatConversation | undefined, userId: string): string | null {
  if (!conv) return null
  return conv.participant_a === userId ? conv.participant_b : conv.participant_a
}

// Most-recent-first ordering for the conversation list.
function sortConvs(convs: ChatConversation[]): ChatConversation[] {
  return [...convs].sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
    return tb - ta
  })
}

// Update a conversation's sidebar preview (decrypting if needed) + bump it up.
async function setConvPreview(convId: string, partnerId: string, msg: ChatMessage, plaintext?: string) {
  let content = plaintext ?? msg.content
  if (plaintext === undefined && msg.is_encrypted && content) {
    const key = await getConvKey(convId, partnerId)
    content = key ? await decryptText(key, content).catch(() => '🔒') : '🔒 Pesan terenkripsi'
  }
  const preview = messagePreview({ message_type: msg.message_type, content, file_name: msg.file_name })
  useChatStore.setState(s => ({
    conversations: sortConvs(s.conversations.map(c =>
      c.id === convId
        ? { ...c, last_preview: preview, last_sender_id: msg.sender_id, last_message_at: msg.created_at }
        : c)),
  }))
}

// Decrypt one message's content (text only). Fails soft to a placeholder.
async function decryptMsg(msg: ChatMessage, key: CryptoKey | null): Promise<ChatMessage> {
  if (!msg.is_encrypted || !msg.content) return msg
  if (!key) return { ...msg, content: '🔒 Pesan terenkripsi' }
  try { return { ...msg, content: await decryptText(key, msg.content) } }
  catch { return { ...msg, content: '🔒 Tidak dapat mendekripsi' } }
}

// Ids currently being decrypted/appended — guards the async window so the
// broadcast and the postgres-INSERT delivery of the same message can't both add.
const _ingestingIds = new Set<string>()

// Decrypt + append an incoming message to the open thread (dedup, guarded).
async function ingestIncoming(msg: ChatMessage, userId: string) {
  const st = useChatStore.getState()
  if (st.currentConvId !== msg.conversation_id) return
  if (_ingestingIds.has(msg.id)) return                       // already in flight
  if (st.messages.some(x => x.id === msg.id)) return          // already present
  _ingestingIds.add(msg.id)
  try {
    const key = await getConvKey(msg.conversation_id, msg.sender_id)
    const m = await decryptMsg(msg, key)
    if (_typingClear) { clearTimeout(_typingClear); _typingClear = null }
    useChatStore.setState(s => {
      if (s.currentConvId !== msg.conversation_id) return s
      if (s.messages.some(x => x.id === m.id)) return { peerTyping: false }
      return { messages: [...s.messages, m], peerTyping: false }
    })
  } finally {
    _ingestingIds.delete(msg.id)
  }
}

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
  peerTyping:    boolean                    // partner is typing in the open thread
  replyTo:       ChatMessage | null         // message being replied to (composer)
  editing:       ChatMessage | null         // message being edited (composer)
  unreadAnchorId: string | null             // first unread message at thread open
  loading:       boolean
  msgLoading:    boolean
  sending:       boolean
  isLocked:      boolean
  hasPinSet:     boolean
  encReady:      boolean                    // E2EE keypair ready this session

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
  notifyTyping:      () => void
  setReplyTo:        (msg: ChatMessage | null) => void
  setEditing:        (msg: ChatMessage | null) => void
  editText:          (msgId: string, text: string, senderId: string) => Promise<void>

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
let _typingClear:     ReturnType<typeof setTimeout>  | null = null
let _lastTypingSent   = 0
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
  clearCryptoSession()
  _userId = ''
  useChatStore.setState({
    isLocked: true, currentConvId: null, messages: [],
    conversations: [], unreadTotal: 0, onlineUsers: {}, encReady: false,
    replyTo: null, editing: null, unreadAnchorId: null, _realtimeSub: null,
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
  peerTyping:    false,
  replyTo:       null,
  editing:       null,
  unreadAnchorId: null,
  loading:       false,
  msgLoading:    false,
  sending:       false,
  isLocked:      !sessionStorage.getItem(SESSION_KEY),
  hasPinSet:     !!localStorage.getItem(PIN_HASH_KEY),
  encReady:      false,
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
    // Decrypt each conversation's last-message preview for the sidebar.
    await Promise.all(convs.map(async c => {
      const lm = c.last_msg
      if (!lm) { c.last_preview = ''; c.last_sender_id = null; return }
      c.last_sender_id = lm.sender_id
      let content = lm.content
      if (lm.is_encrypted && content) {
        const partnerId = c.participant_a === userId ? c.participant_b : c.participant_a
        const key = await getConvKey(c.id, partnerId)
        content = key ? await decryptText(key, content).catch(() => '🔒') : '🔒 Pesan terenkripsi'
      }
      c.last_preview = messagePreview({ message_type: lm.message_type, content, file_name: lm.file_name })
    }))
    const total = convs.reduce((sum, c) => sum + (c.unread_count ?? 0), 0)
    set({ conversations: convs, loading: false, unreadTotal: total })
  },

  selectConv: async (id, userId) => {
    if (_convChannel) { _convChannel.unsubscribe(); _convChannel = null }

    if (_typingClear) { clearTimeout(_typingClear); _typingClear = null }
    set({ peerTyping: false, replyTo: null, editing: null, unreadAnchorId: null })

    if (!id) { set({ currentConvId: null, messages: [] }); return }

    set({ currentConvId: id, msgLoading: true })
    const msgs = await getMessages(id)
    // Decrypt any encrypted messages with the per-conversation key.
    const partnerId = partnerOf(get().conversations.find(c => c.id === id), userId)
    const key = partnerId && msgs.some(m => m.is_encrypted)
      ? await getConvKey(id, partnerId) : null
    const decrypted = key || msgs.some(m => m.is_encrypted)
      ? await Promise.all(msgs.map(m => decryptMsg(m, key)))
      : msgs
    // Capture the unread boundary BEFORE marking read (drives the divider).
    const firstUnread = decrypted.find(m => m.sender_id !== userId && !m.read_at && !m.deleted_at)
    set({ messages: decrypted, msgLoading: false, unreadAnchorId: firstUnread?.id ?? null })

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
        void ingestIncoming(msg, userId)
        if (document.visibilityState === 'visible') {
          markMessagesDelivered(id, userId)
          markMessagesRead(id, userId)
        }
      })
      .on('broadcast', { event: 'del' }, ({ payload }) => {
        set(s => ({ messages: s.messages.filter(m => m.id !== payload.id) }))
      })
      .on('broadcast', { event: 'edit' }, async ({ payload }) => {
        const { id: mid, content, is_encrypted, edited_at, sender_id } = payload
        let text = content as string
        if (is_encrypted && content) {
          const key = await getConvKey(id, sender_id)
          text = key ? await decryptText(key, content).catch(() => '🔒') : '🔒 Pesan terenkripsi'
        }
        set(s => ({ messages: s.messages.map(m => m.id === mid ? { ...m, content: text, is_encrypted, edited_at } : m) }))
      })
      .on('broadcast', { event: 'clear' }, () => set({ messages: [] }))
      .on('broadcast', { event: 'typing' }, () => {
        set({ peerTyping: true })
        if (_typingClear) clearTimeout(_typingClear)
        _typingClear = setTimeout(() => set({ peerTyping: false }), 3500)
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
    if (conv) set(s => ({ conversations: [conv, ...s.conversations] }))
    return conv
  },

  sendText: async (text, senderId) => {
    const convId = get().currentConvId
    if (!convId || !text.trim()) return
    const body = text.trim()
    const replyId = get().replyTo?.id ?? null
    set({ sending: true, replyTo: null })
    get().resetIdle()

    // Encrypt for storage if a conversation key is available.
    const partnerId = partnerOf(get().conversations.find(c => c.id === convId), senderId)
    let stored = body, encrypted = false
    if (partnerId) {
      const key = await getConvKey(convId, partnerId)
      if (key) { try { stored = await encryptText(key, body); encrypted = true } catch { /* fall back to plaintext */ } }
    }

    const msg = await sendMessage(convId, senderId, stored, 'text', undefined, undefined, undefined, encrypted, replyId)
    if (msg) {
      const localMsg = encrypted ? { ...msg, content: body } : msg   // show plaintext locally
      set(s => ({
        messages: s.messages.some(m => m.id === msg.id) ? s.messages : [...s.messages, localMsg],
        conversations: sortConvs(s.conversations.map(c =>
          c.id === convId ? { ...c, last_message_at: msg.created_at, last_preview: body, last_sender_id: senderId } : c
        )),
      }))
      // Broadcast the stored (cipher) row so the partner decrypts with their key.
      _convChannel?.send({ type: 'broadcast', event: 'msg', payload: { msg } })
    }
    set({ sending: false })
  },

  sendFile: async (file, senderId) => {
    const convId = get().currentConvId
    if (!convId) return
    const replyId = get().replyTo?.id ?? null
    set({ sending: true, replyTo: null })
    get().resetIdle()
    const result = await uploadChatFile(convId, file)
    if (!result) { set({ sending: false }); return }
    const type: ChatMessage['message_type'] =
      file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio'
      : 'document'
    const msg = await sendMessage(convId, senderId, null, type, result.url, result.name, result.size, false, replyId)
    if (msg) {
      const preview = messagePreview({ message_type: type, content: null, file_name: result.name })
      set(s => ({
        messages: s.messages.some(m => m.id === msg.id) ? s.messages : [...s.messages, msg],
        conversations: sortConvs(s.conversations.map(c =>
          c.id === convId ? { ...c, last_message_at: msg.created_at, last_preview: preview, last_sender_id: senderId } : c
        )),
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

  notifyTyping: () => {
    const now = Date.now()
    if (now - _lastTypingSent < 1500) return   // throttle
    _lastTypingSent = now
    _convChannel?.send({ type: 'broadcast', event: 'typing', payload: {} })
  },

  setReplyTo: (msg) => set({ replyTo: msg, editing: null }),

  setEditing: (msg) => set({ editing: msg, replyTo: null }),

  editText: async (msgId, text, senderId) => {
    const body = text.trim()
    const convId = get().currentConvId
    if (!body || !convId) { set({ editing: null }); return }

    const partnerId = partnerOf(get().conversations.find(c => c.id === convId), senderId)
    let stored = body, encrypted = false
    if (partnerId) {
      const key = await getConvKey(convId, partnerId)
      if (key) { try { stored = await encryptText(key, body); encrypted = true } catch { /* plaintext */ } }
    }
    const editedAt = new Date().toISOString()
    await editMessage(msgId, stored, encrypted)
    set(s => ({
      editing: null,
      messages: s.messages.map(m =>
        m.id === msgId ? { ...m, content: body, is_encrypted: encrypted, edited_at: editedAt } : m),
    }))
    _convChannel?.send({
      type: 'broadcast', event: 'edit',
      payload: { id: msgId, content: stored, is_encrypted: encrypted, edited_at: editedAt, sender_id: senderId },
    })
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

          if (msg.sender_id === userId) {
            // Echo of my own message in the open thread — ignore (already optimistic)
            return
          }

          // I'm the recipient → acknowledge delivery + refresh sidebar preview
          markMessagesDelivered(msg.conversation_id, userId)
          void setConvPreview(msg.conversation_id, msg.sender_id, msg)

          const viewingThread = state.currentConvId === msg.conversation_id
          const focused       = document.visibilityState === 'visible'

          if (viewingThread) {
            void ingestIncoming(msg, userId)   // decrypts + dedups
            if (focused) markMessagesRead(msg.conversation_id, userId)
          } else {
            set(s => ({
              unreadTotal: s.unreadTotal + 1,
              conversations: sortConvs(s.conversations.map(c =>
                c.id === msg.conversation_id
                  ? { ...c, unread_count: (c.unread_count ?? 0) + 1, last_message_at: msg.created_at }
                  : c
              )),
            }))
          }

          // Notify + sound when not actively reading this thread.
          if (!viewingThread || !focused) {
            const conv  = state.conversations.find(c => c.id === msg.conversation_id)
            const other = conv ? (conv.participant_a === userId ? conv.profile_b : conv.profile_a) : null
            const name  = other?.full_name ?? other?.username ?? 'Pesan baru'
            playPing()
            if (state.isLocked) {
              showMessageNotification(name, 'Anda menerima pesan baru', { tag: `chat-${msg.conversation_id}`, onClickHash: '#chat' })
            } else if (msg.is_encrypted && msg.content) {
              getConvKey(msg.conversation_id, msg.sender_id).then(async key => {
                let body = '🔒 Pesan baru'
                if (key) { try { body = await decryptText(key, msg.content!) } catch { /* keep placeholder */ } }
                showMessageNotification(name, body, { tag: `chat-${msg.conversation_id}`, onClickHash: '#chat' })
              })
            } else {
              showMessageNotification(name, previewOf(msg), { tag: `chat-${msg.conversation_id}`, onClickHash: '#chat' })
            }
          }
        }
      )
      // Status changes: delivered_at / read_at / reactions / soft-delete.
      // Only merge status fields — never overwrite the locally decrypted
      // `content` with the DB ciphertext.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as ChatMessage
          if (get().currentConvId !== msg.conversation_id) return
          set(s => ({
            messages: msg.deleted_at
              ? s.messages.filter(m => m.id !== msg.id)
              : s.messages.map(m => m.id === msg.id ? {
                  ...m,
                  delivered_at: msg.delivered_at,
                  read_at:      msg.read_at,
                  is_read:      msg.is_read,
                  reactions:    msg.reactions ?? m.reactions,
                  edited_at:    msg.edited_at,
                } : m),
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
    // Provision the E2EE keypair (wrapped by this PIN).
    const ok = await initKeysOnUnlock(pin)
    set({ encReady: ok })
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
      // Unwrap (or provision) the E2EE private key with the same PIN.
      const keysOk = await initKeysOnUnlock(pin)
      set({ encReady: keysOk })
    }
    return ok
  },

  lock: () => {
    sessionStorage.removeItem(SESSION_KEY)
    stopIdleTimer()
    clearCryptoSession()
    set({ isLocked: true, encReady: false })
  },

  clearPin: () => {
    localStorage.removeItem(PIN_HASH_KEY)
    localStorage.removeItem(PIN_SALT_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    stopIdleTimer()
    clearCryptoSession()
    set({ hasPinSet: false, isLocked: true, encReady: false })
  },
}))
