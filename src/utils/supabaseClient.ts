// ─────────────────────────────────────────────
// SUPABASE CLIENT & API HELPERS
// ─────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'
import type { AppearanceSettings, ThemeId } from '../types'

const SUPABASE_URL  = 'https://qsvrqdnyjywjzxkqwszl.supabase.co'
const SUPABASE_ANON = 'sb_publishable_wzaKkf02vmfOvqIb3wHgKQ_mZgecfAn'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

// ── Profile interface ─────────────────────────
export interface Profile {
  id:           string
  username:     string
  role:         'superadmin' | 'admin' | 'admin_unit' | 'user'
  unit_id:      '' | 'pro' | 'cro' | 'klaim'
  avatar_emoji: string
  avatar_url:   string
  appearance:   Record<string, unknown>
  created_at:   string
}

// ── Auth ──────────────────────────────────────
export const signIn  = async (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password })
export const signOut = async () => supabase.auth.signOut()

// ── Profile ───────────────────────────────────
export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) { console.error('getProfile:', error); return null }
  return data as Profile
}

export const getAllProfiles = async (): Promise<Profile[]> => {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
  if (error) { console.error('getAllProfiles:', error); return [] }
  return (data ?? []) as Profile[]
}

export const getUnitProfiles = async (unitId: string): Promise<Profile[]> => {
  const { data, error } = await supabase.from('profiles').select('*')
    .eq('unit_id', unitId).order('created_at', { ascending: true })
  if (error) { console.error('getUnitProfiles:', error); return [] }
  return (data ?? []) as Profile[]
}

export const updateProfile = async (
  userId: string,
  updates: Partial<Pick<Profile, 'role' | 'unit_id' | 'username' | 'avatar_emoji' | 'avatar_url' | 'appearance'>>
) => supabase.from('profiles').update(updates).eq('id', userId)

// ── Appearance per user ───────────────────────
export const saveUserAppearance = async (userId: string, appearance: AppearanceSettings) =>
  supabase.from('profiles').update({ appearance: appearance as unknown as Record<string, unknown> }).eq('id', userId)

export const loadUserAppearance = async (userId: string): Promise<AppearanceSettings | null> => {
  const { data, error } = await supabase.from('profiles').select('appearance').eq('id', userId).single()
  if (error || !data?.appearance) return null
  return data.appearance as unknown as AppearanceSettings
}

// ── Avatar upload ─────────────────────────────
export const uploadAvatar = async (userId: string, blob: Blob): Promise<string | null> => {
  const path = `${userId}.webp`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    contentType: 'image/webp', upsert: true,
  })
  if (error) { console.error('uploadAvatar:', error); return null }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl + '?t=' + Date.now()
}

// ── Global config ─────────────────────────────
const GLOBAL_CONFIG_ID = '00000000-0000-0000-0000-000000000001'

export const loadGlobalConfig = async (): Promise<Record<string, unknown> | null> => {
  const { data, error } = await supabase.from('dashboard_config').select('config').eq('id', GLOBAL_CONFIG_ID).single()
  if (error) { console.error('loadGlobalConfig:', error); return null }
  return data?.config ?? null
}

export const saveGlobalConfig = async (config: Record<string, unknown>) =>
  supabase.from('dashboard_config').update({ config, updated_at: new Date().toISOString() }).eq('id', GLOBAL_CONFIG_ID)

// ── Unit config ───────────────────────────────
export const loadUnitConfig = async (unitId: string): Promise<Record<string, unknown> | null> => {
  const { data, error } = await supabase.from('unit_configs').select('config').eq('id', unitId).single()
  if (error) { console.error('loadUnitConfig:', error); return null }
  return data?.config ?? null
}

export const saveUnitConfig = async (unitId: string, config: Record<string, unknown>) =>
  supabase.from('unit_configs').update({ config, updated_at: new Date().toISOString() }).eq('id', unitId)

// ── Theme global (superadmin only) ────────────
export const saveGlobalTheme = async (theme: ThemeId) => {
  const { data } = await supabase.from('dashboard_config').select('config').eq('id', GLOBAL_CONFIG_ID).single()
  if (!data) return
  const cfg = (data.config ?? {}) as Record<string, unknown>
  cfg.globalTheme = theme
  return supabase.from('dashboard_config').update({ config: cfg }).eq('id', GLOBAL_CONFIG_ID)
}

export const loadGlobalTheme = async (): Promise<ThemeId> => {
  const { data } = await supabase.from('dashboard_config').select('config').eq('id', GLOBAL_CONFIG_ID).single()
  return ((data?.config as any)?.globalTheme ?? 'dark-mint') as ThemeId
}

// ── Create user via Edge Function ────────────
export const createUser = async (
  username: string, password: string,
  role: Profile['role'], unit_id: Profile['unit_id'],
) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: { message: 'Tidak ada sesi aktif' } }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ username, password, role, unit_id }),
  })
  const data = await res.json()
  if (!res.ok) return { error: { message: data.error || 'Gagal membuat user' } }
  return { data }
}

// ── Update password via Edge Function ─────────
export const updateUserPassword = async (userId: string, password: string) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: { message: 'Tidak ada sesi aktif' } }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/update-user-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ userId, password }),
  })
  const data = await res.json()
  if (!res.ok) return { error: { message: data.error || 'Gagal update password' } }
  return { data }
}

// ── Coffee URL ────────────────────────────────
export const loadCoffeeUrl = async (): Promise<string> => {
  const { data } = await supabase.from('dashboard_config').select('config').eq('id', GLOBAL_CONFIG_ID).single()
  return ((data?.config as any)?.coffeeUrl ?? '') as string
}
