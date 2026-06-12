// ─────────────────────────────────────────────────────────────
// SUPABASE CLIENT — Koneksi dan semua fungsi komunikasi dengan DB
// ─────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import type { AppearanceSettings, ThemeId } from '../types'

// URL dan kunci publik Supabase
// Gunakan env vars jika tersedia, fallback ke hardcode untuk development
const SUPABASE_URL  = (import.meta as any).env?.VITE_SUPABASE_URL  ?? 'https://qsvrqdnyjywjzxkqwszl.supabase.co'
const SUPABASE_ANON = (import.meta as any).env?.VITE_SUPABASE_ANON ?? 'sb_publishable_wzaKkf02vmfOvqIb3wHgKQ_mZgecfAn'

// Buat koneksi Supabase dengan konfigurasi sesi otomatis
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:     true,  // simpan sesi di localStorage
    autoRefreshToken:   true,  // perbarui token otomatis sebelum expired
    detectSessionInUrl: true,  // aktifkan untuk OAuth redirect (Google Sign-In)
  },
})

// ── Tipe data profil user ─────────────────────────────────────
export interface Profile {
  id:            string   // UUID unik user
  username:      string   // nama login (tanpa @jateamhub.app)
  full_name:     string   // nama lengkap
  role:          'superadmin' | 'admin' | 'user' | 'guest'
  region_scope:  string   // wilayah: 'global' | 'sby' | 'mks' | dll
  unit_scope:    string   // unit: 'general' | 'pro' | 'cro' | 'klaim' | 'ae'
  unit_id:       string   // legacy — unit lama sebelum migrasi
  branch_id:     string   // legacy — cabang lama sebelum migrasi
  avatar_emoji:  string   // emoji avatar (hanya admin ke atas)
  avatar_url:    string   // URL foto profil
  emoji:         string   // emoji tambahan di samping nama (bukan avatar)
  appearance:    Record<string, unknown> // preferensi tampilan per user
  google_email?: string | null  // Gmail asli untuk user OAuth Google
  auth_provider?: string        // 'email' (default) | 'google'
  chat_enabled?: boolean        // akses fitur chat — diatur oleh superadmin
  last_seen?:    string | null  // presence — terakhir aktif (untuk "last seen")
  created_at:    string
  updated_at:    string
}

// ── Tipe data shared section (section dari admin) ─────────────
export interface SharedSection {
  id:            string
  created_by:    string   // UUID admin yang membuat
  title:         string
  icon:          string
  subtitle:      string
  items:         unknown[] // daftar link di dalam section
  accent_color:  string
  visibility:    'all' | 'global' | 'role' | 'region' | 'unit'
  target_role:   string | null   // khusus role tertentu
  target_region: string | null   // khusus wilayah tertentu
  target_unit:   string | null   // khusus unit tertentu
  layout_hint:   { w: number; h: number } // ukuran default section
  is_active:     boolean
  created_at:    string
  updated_at:    string
}

// ── Fungsi Autentikasi ────────────────────────────────────────

// Login dengan email dan password
export const signIn  = async (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password })

// Logout dan hapus sesi
export const signOut = async () => supabase.auth.signOut()

// Login dengan Google OAuth
export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })

// ── Fungsi Profil User ────────────────────────────────────────

// Ambil profil satu user berdasarkan ID
export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userId).single()
  if (error) { console.error('getProfile:', error); return null }
  return data as Profile
}

// Ambil semua profil — untuk superadmin dan admin global
export const getAllProfiles = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('profiles').select('*').order('created_at', { ascending: true })
  if (error) { console.error('getAllProfiles:', error); return [] }
  return (data ?? []) as Profile[]
}

// Ambil profil berdasarkan wilayah dan unit — untuk admin wilayah/unit
export const getProfilesByScope = async (
  regionScope: string,
  unitScope: string
): Promise<Profile[]> => {
  let query = supabase.from('profiles').select('*')
  // Filter wilayah jika bukan global
  if (regionScope !== 'global') query = query.eq('region_scope', regionScope)
  // Filter unit jika bukan general
  if (unitScope !== 'general')  query = query.eq('unit_scope', unitScope)
  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) { console.error('getProfilesByScope:', error); return [] }
  return (data ?? []) as Profile[]
}

// Update data profil user — hanya field yang diizinkan
export const updateProfile = async (
  userId: string,
  updates: Partial<Pick<Profile,
    'role' | 'unit_id' | 'unit_scope' | 'region_scope' | 'branch_id' |
    'username' | 'full_name' | 'avatar_emoji' | 'avatar_url' | 'emoji' | 'appearance' |
    'chat_enabled'
  >>
) => supabase.from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)

// ── Fungsi Preferensi Tampilan (per user) ─────────────────────

// Simpan preferensi tampilan user ke DB profil mereka
export const saveUserAppearance = async (
  userId: string,
  appearance: AppearanceSettings
) => supabase.from('profiles')
    .update({ appearance: appearance as unknown as Record<string, unknown> })
    .eq('id', userId)

// Ambil preferensi tampilan user dari DB
export const loadUserAppearance = async (
  userId: string
): Promise<AppearanceSettings | null> => {
  const { data, error } = await supabase
    .from('profiles').select('appearance').eq('id', userId).single()
  if (error || !data?.appearance) return null
  return data.appearance as unknown as AppearanceSettings
}

// ── Fungsi Upload Avatar ──────────────────────────────────────

// Upload foto profil ke Supabase Storage, return URL publik
export const uploadAvatar = async (
  userId: string,
  blob: Blob
): Promise<string | null> => {
  const path = `${userId}.webp`
  // Upload atau timpa file yang sudah ada
  const { error } = await supabase.storage
    .from('avatars').upload(path, blob, { contentType: 'image/webp', upsert: true })
  if (error) { console.error('uploadAvatar:', error); return null }
  // Ambil URL publik + timestamp untuk hindari cache browser
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl + '?t=' + Date.now()
}

// ── Fungsi User Layout (section pribadi) ─────────────────────

// Ambil layout section pribadi user dari tabel user_layouts
export const getUserLayout = async (
  userId: string
): Promise<unknown[] | null> => {
  const { data, error } = await supabase
    .from('user_layouts').select('sections').eq('user_id', userId).single()
  if (error) return null // belum ada layout = null
  return data?.sections ?? []
}

// Simpan layout section pribadi user — upsert (insert atau update)
export const saveUserLayout = async (
  userId: string,
  sections: unknown[],
  retries = 2
): Promise<boolean> => {
  for (let i = 0; i <= retries; i++) {
    try {
      // Timeout 8 detik — jika lebih lama, anggap gagal dan retry
      const result = await Promise.race([
        supabase.from('user_layouts').upsert({
          user_id:    userId,
          sections,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' }),
        new Promise<{ error: { message: string } }>((_, reject) =>
          setTimeout(() => reject({ error: { message: 'Timeout 8s' } }), 8000)
        )
      ]) as { error: any }

      if (!result.error) return true

      // Auth error → coba refresh session lalu retry
      if (result.error.code === 'PGRST301' || result.error.message?.includes('JWT')) {
        const { error: refreshErr } = await supabase.auth.refreshSession()
        if (refreshErr) {
          // Refresh token invalid/expired → paksa logout agar user tidak stuck
          window.dispatchEvent(new Event('jateamhub-session-expired'))
          return false
        }
        continue
      }

      if (i === retries) return false
    } catch {
      if (i === retries) return false
      await new Promise(r => setTimeout(r, 500 * (i + 1)))
    }
  }
  return false
}

// ── Fungsi Shared Sections (section dari admin) ───────────────

// Ambil shared sections yang relevan untuk user yang login
export const getSharedSections = async (
  role: string,
  regionScope: string,
  unitScope: string
): Promise<SharedSection[]> => {
  // Ambil semua shared section yang aktif
  const { data, error } = await supabase
    .from('shared_sections')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) { console.error('getSharedSections:', error); return [] }

  const sections = (data ?? []) as SharedSection[]

  // Filter berdasarkan visibility dan scope user
  return sections.filter(s => {
    // Admin dan superadmin lihat semua
    if (role === 'superadmin' || role === 'admin') return true
    // Global — tampil ke semua user
    if (s.visibility === 'global') return true
    // Section dari admin regional — tampil ke user di region yang sama
    if (s.visibility === 'region') return s.target_region === regionScope
    // Section dari admin unit — tampil ke user di region+unit yang sama
    if (s.visibility === 'unit')
      return s.target_region === regionScope && s.target_unit === unitScope
    return false
  })
}

// Ambil SEMUA shared sections — untuk admin yang ingin kelola
export const getAllSharedSections = async (): Promise<SharedSection[]> => {
  const { data, error } = await supabase
    .from('shared_sections').select('*').order('created_at', { ascending: true })
  if (error) { console.error('getAllSharedSections:', error); return [] }
  return (data ?? []) as SharedSection[]
}

// Buat shared section baru
export const createSharedSection = async (
  section: Omit<SharedSection, 'id' | 'created_at' | 'updated_at'>
) => supabase.from('shared_sections').insert(section)

// Update shared section yang sudah ada
export const updateSharedSection = async (
  sectionId: string,
  updates: Partial<SharedSection>
) => supabase.from('shared_sections')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', sectionId)

// Hapus shared section
export const deleteSharedSection = async (sectionId: string) =>
  supabase.from('shared_sections').delete().eq('id', sectionId)

// ── Fungsi Theme Global ───────────────────────────────────────

// ID config global yang tersimpan di dashboard_config
const GLOBAL_CONFIG_ID = '00000000-0000-0000-0000-000000000001'

// Simpan pilihan theme global — hanya superadmin
export const saveGlobalTheme = async (theme: ThemeId) => {
  const { data } = await supabase
    .from('dashboard_config').select('config').eq('id', GLOBAL_CONFIG_ID).single()
  const cfg = ((data?.config ?? {}) as Record<string, unknown>)
  cfg.globalTheme = theme
  return supabase.from('dashboard_config')
    .update({ config: cfg }).eq('id', GLOBAL_CONFIG_ID)
}

// Ambil theme global yang berlaku
export const loadGlobalTheme = async (): Promise<ThemeId> => {
  const { data } = await supabase
    .from('dashboard_config').select('config').eq('id', GLOBAL_CONFIG_ID).single()
  return (((data?.config as any)?.globalTheme) ?? 'dark-mint') as ThemeId
}

// ── Fungsi Edge Functions ─────────────────────────────────────

// Helper untuk memanggil Supabase Edge Function dengan autentikasi JWT
const edgeFetch = async (fn: string, body: Record<string, unknown>) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: { message: 'Tidak ada sesi aktif' } }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) return { error: { message: data.error || `Gagal: ${fn}` } }
  return { data }
}

// Buat user baru via Edge Function (untuk hindari expose service key)
export const createUser = (
  username:     string,
  password:     string,
  role:         Profile['role'],
  unit_id:      string,
  region_scope?: string,
  unit_scope?:   string,
  full_name?:    string,
  phone?:        string,
) => edgeFetch('create-user', {
  username, password, role, unit_id,
  region_scope: region_scope ?? 'global',
  unit_scope:   unit_scope   ?? 'general',
  full_name:    full_name    ?? '',
  phone:        phone        ?? '',
})

// Reset password user via Edge Function
export const updateUserPassword = (userId: string, password: string) =>
  edgeFetch('update-user-password', { userId, password })

// Ambil URL donasi kopi dari config global
export const loadCoffeeUrl = async (): Promise<string> => {
  const { data } = await supabase
    .from('dashboard_config').select('config').eq('id', GLOBAL_CONFIG_ID).single()
  return (((data?.config as any)?.coffeeUrl) ?? '') as string
}

// ── Pending Registrations ─────────────────────────────────────

export interface PendingRegistration {
  id:            string
  full_name:     string
  username:      string
  phone:         string
  region_scope:  string
  unit_scope:    string
  temp_password: string
  status:        'pending' | 'approved' | 'rejected'
  notes?:        string
  created_at:    string
  reviewed_at?:  string
}

// Submit pendaftaran baru dari halaman register
export const submitRegistration = async (
  data: Omit<PendingRegistration, 'id' | 'status' | 'created_at'>
) => supabase.from('pending_registrations').insert(data)

// Ambil semua pending registrations — hanya superadmin
export const getPendingRegistrations = async (): Promise<PendingRegistration[]> => {
  const { data, error } = await supabase
    .from('pending_registrations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('getPendingRegistrations:', error); return [] }
  return (data ?? []) as PendingRegistration[]
}

// Approve registration — buat akun dan update status
export const approveRegistration = async (
  regId:      string,
  reg:        PendingRegistration,
  reviewerId: string,
) => {
  const result = await createUser(
    reg.username, reg.temp_password, 'user',
    reg.unit_scope, reg.region_scope, reg.unit_scope,
    reg.full_name, reg.phone,
  )
  if ((result as any).error) return result

  await supabase.from('pending_registrations').update({
    status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: reviewerId,
  }).eq('id', regId)

  return result
}

// Reject registration
export const rejectRegistration = async (regId: string, reviewerId: string, notes?: string) =>
  supabase.from('pending_registrations').update({
    status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: reviewerId,
    notes,
  }).eq('id', regId)

// Kirim notif WA via Fonnte (dipanggil dari edge function nanti)
export const sendWaNotification = async (phone: string, message: string) => {
  // TODO: panggil edge function send-wa saat token Fonnte sudah ada
  // console.log('[WA Notif placeholder]', phone, message)
}

// ── Todo History ──────────────────────────────────────────────
export const saveTodoHistory = async (
  userId: string,
  items: import('../types').TodoItem[],
  status: 'done' | 'overdue' = 'done'
) => {
  if (!items.length) return
  const rows = items.map(item => ({
    user_id:    userId,
    task_text:  item.text,
    due_date:   item.dueTime ?? null,
    status,
    created_at: new Date(item.createdAt).toISOString(),
    done_at:    item.doneAt ? new Date(item.doneAt).toISOString() : null,
    date:       item.date,
  }))
  return supabase.from('todo_history').insert(rows)
}

export const getTodoHistory = async (userId: string, limit = 200) => {
  const { data } = await supabase
    .from('todo_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

// ── Chat ──────────────────────────────────────────────────────

export interface ChatConversation {
  id:               string
  created_by:       string
  participant_a:    string
  participant_b:    string
  is_active:        boolean
  last_message_at:  string | null
  created_at:       string
  profile_a?:       Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url' | 'avatar_emoji' | 'emoji' | 'last_seen'>
  profile_b?:       Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url' | 'avatar_emoji' | 'emoji' | 'last_seen'>
  unread_count?:    number
}

// Reactions: emoji → array of user ids who reacted
export type MessageReactions = Record<string, string[]>

export interface ChatMessage {
  id:               string
  conversation_id:  string
  sender_id:        string
  content:          string | null
  message_type:     'text' | 'image' | 'video' | 'document' | 'audio'
  file_url:         string | null
  file_name:        string | null
  file_size:        number | null
  is_read:          boolean
  delivered_at:     string | null   // diterima device penerima
  read_at:          string | null   // dibaca penerima
  reactions:        MessageReactions
  is_encrypted:     boolean         // content berisi ciphertext (E2EE)
  reply_to:         string | null   // id pesan yang dibalas
  created_at:       string
  deleted_at:       string | null
}

export const getConversations = async (userId: string): Promise<ChatConversation[]> => {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('is_active', true)
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })
  if (error) { console.error('getConversations:', error); return [] }
  const convs = (data ?? []) as ChatConversation[]
  if (!convs.length) return []

  const convIds = convs.map(c => c.id)

  // Fetch participant profiles
  const pids = [...new Set(convs.flatMap(c => [c.participant_a, c.participant_b]))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id,full_name,username,avatar_url,avatar_emoji,emoji,last_seen')
    .in('id', pids)
  const pMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  // Fetch unread counts per conversation
  const { data: unreadRows } = await supabase
    .from('chat_messages')
    .select('conversation_id')
    .in('conversation_id', convIds)
    .eq('is_read', false)
    .neq('sender_id', userId)
    .is('deleted_at', null)
  const unreadMap: Record<string, number> = {}
  for (const row of (unreadRows ?? [])) {
    unreadMap[row.conversation_id] = (unreadMap[row.conversation_id] ?? 0) + 1
  }

  return convs.map(c => ({
    ...c,
    profile_a:    pMap[c.participant_a] ?? null,
    profile_b:    pMap[c.participant_b] ?? null,
    unread_count: unreadMap[c.id] ?? 0,
  }))
}

export const getMessages = async (conversationId: string, limit = 50): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('getMessages:', error); return [] }
  return ((data ?? []) as ChatMessage[]).reverse()
}

export const createConversation = async (
  createdBy: string,
  participantB: string,
): Promise<ChatConversation | null> => {
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({
      created_by:    createdBy,
      participant_a: createdBy,
      participant_b: participantB,
    })
    .select()
    .single()
  if (error) { console.error('createConversation:', error); return null }
  const conv = data as ChatConversation

  // Fetch profiles for both participants
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id,full_name,username,avatar_url,avatar_emoji,emoji')
    .in('id', [createdBy, participantB])
  const pMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  return {
    ...conv,
    profile_a: pMap[conv.participant_a] ?? null,
    profile_b: pMap[conv.participant_b] ?? null,
  }
}

export const sendMessage = async (
  conversationId: string,
  senderId:       string,
  content:        string | null,
  type:           ChatMessage['message_type'],
  fileUrl?:       string,
  fileName?:      string,
  fileSize?:      number,
  isEncrypted?:   boolean,
  replyTo?:       string | null,
): Promise<ChatMessage | null> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_id:       senderId,
      content,
      message_type:    type,
      file_url:        fileUrl  ?? null,
      file_name:       fileName ?? null,
      file_size:       fileSize ?? null,
      is_encrypted:    isEncrypted ?? false,
      reply_to:        replyTo ?? null,
    })
    .select()
    .single()
  if (error) { console.error('sendMessage:', error); return null }
  // Update last_message_at on conversation
  await supabase.from('chat_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)
  return data as ChatMessage
}

export const uploadChatFile = async (
  conversationId: string,
  file:           File,
): Promise<{ url: string; name: string; size: number } | null> => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_').slice(0, 100)
  const path = `${session.user.id}/${conversationId}/${Date.now()}_${safeName}`
  const { error } = await supabase.storage
    .from('chat-files').upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) { console.error('uploadChatFile:', error); return null }
  // Bucket is public — getPublicUrl works for public buckets
  const { data } = supabase.storage.from('chat-files').getPublicUrl(path)
  return { url: data.publicUrl, name: file.name, size: file.size }
}

export const clearConversationMessages = async (conversationId: string) =>
  supabase.from('chat_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)

export const markMessagesRead = async (conversationId: string, userId: string) =>
  supabase.from('chat_messages')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .is('read_at', null)
    .neq('sender_id', userId)

// Mark all incoming messages as delivered (recipient device received them).
export const markMessagesDelivered = async (conversationId: string, userId: string) =>
  supabase.from('chat_messages')
    .update({ delivered_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .is('delivered_at', null)
    .neq('sender_id', userId)

// Toggle an emoji reaction on a message for the given user.
export const toggleReaction = async (
  messageId: string,
  userId:    string,
  emoji:     string,
): Promise<MessageReactions | null> => {
  const { data: row, error: readErr } = await supabase
    .from('chat_messages').select('reactions').eq('id', messageId).single()
  if (readErr) { console.error('toggleReaction read:', readErr); return null }
  const reactions: MessageReactions = { ...(row?.reactions ?? {}) }
  const users = new Set(reactions[emoji] ?? [])
  if (users.has(userId)) users.delete(userId)
  else users.add(userId)
  if (users.size) reactions[emoji] = [...users]
  else delete reactions[emoji]
  const { error } = await supabase
    .from('chat_messages').update({ reactions }).eq('id', messageId)
  if (error) { console.error('toggleReaction write:', error); return null }
  return reactions
}

export const deleteMessage = async (messageId: string) =>
  supabase.from('chat_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)

// ── Presence: heartbeat last_seen ─────────────────────────────
export const updateLastSeen = async (userId: string) =>
  supabase.from('profiles')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', userId)

export const getLastSeen = async (userId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('profiles').select('last_seen').eq('id', userId).single()
  return data?.last_seen ?? null
}

export const getChatEnabled = async (): Promise<boolean> => {
  const { data } = await supabase
    .from('dashboard_config').select('chat_enabled').eq('id', GLOBAL_CONFIG_ID).single()
  return (data as any)?.chat_enabled ?? false
}

export const setChatEnabled = async (enabled: boolean) =>
  supabase.from('dashboard_config')
    .update({ chat_enabled: enabled })
    .eq('id', GLOBAL_CONFIG_ID)
