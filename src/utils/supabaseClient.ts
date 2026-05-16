// ─────────────────────────────────────────────────────────────
// SUPABASE CLIENT — Koneksi dan semua fungsi komunikasi dengan DB
// ─────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import type { AppearanceSettings, ThemeId } from '../types'

// URL dan kunci publik Supabase — aman dipakai di frontend
const SUPABASE_URL  = 'https://qsvrqdnyjywjzxkqwszl.supabase.co'
const SUPABASE_ANON = 'sb_publishable_wzaKkf02vmfOvqIb3wHgKQ_mZgecfAn'

// Buat koneksi Supabase dengan konfigurasi sesi otomatis
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:     true,  // simpan sesi di localStorage
    autoRefreshToken:   true,  // perbarui token otomatis sebelum expired
    detectSessionInUrl: false, // jangan cek token di URL (bukan OAuth redirect)
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
  visibility:    'all' | 'role' | 'region' | 'unit' // siapa yang bisa lihat
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
    'username' | 'full_name' | 'avatar_emoji' | 'avatar_url' | 'emoji' | 'appearance'
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
  sections: unknown[]
) => supabase.from('user_layouts').upsert({
  user_id:    userId,
  sections,
  updated_at: new Date().toISOString(),
}, { onConflict: 'user_id' })

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
  // Tidak ada lagi 'all' — hanya 'region' dan 'unit'
  return sections.filter(s => {
    // Admin dan superadmin lihat semua
    if (role === 'superadmin' || role === 'admin') return true
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
  unit_scope?:   string
) => edgeFetch('create-user', {
  username, password, role, unit_id,
  region_scope: region_scope ?? 'global',
  unit_scope:   unit_scope   ?? 'general',
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
