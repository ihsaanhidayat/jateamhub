// v2
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://qsvrqdnyjywjzxkqwszl.supabase.co'
const SUPABASE_ANON = 'sb_publishable_wzaKkf02vmfOvqIb3wHgKQ_mZgecfAn'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false,
  },
})

// ── Types ────────────────────────────────────────────────
export interface Profile {
  id:            string
  username:      string
  role:          'superadmin' | 'admin' | 'user'
  unit_id:       '' | 'pro' | 'cro' | 'klaim'
  avatar_emoji:  string
  is_unit_admin: boolean
  appearance:    Record<string, unknown>
  created_at:    string
}

// ── Auth helpers ─────────────────────────────────────────
export const signIn = async (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = async () => supabase.auth.signOut()

export const getSession = async () => supabase.auth.getSession()

// ── Profile helpers ──────────────────────────────────────
export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) { console.error('getProfile error:', error); return null }
  return data as Profile
}

export const getAllProfiles = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) { console.error('getAllProfiles error:', error); return [] }
  return (data ?? []) as Profile[]
}

export const updateProfile = async (
  userId: string,
  updates: Partial<Pick<Profile, 'role' | 'unit_id' | 'username' | 'avatar_emoji' | 'is_unit_admin' | 'appearance'>>
) => supabase.from('profiles').update(updates).eq('id', userId)

// ── Config helpers ───────────────────────────────────────
const CONFIG_ID = '00000000-0000-0000-0000-000000000001'

export const loadConfigFromDB = async (): Promise<Record<string, unknown> | null> => {
  const { data, error } = await supabase
    .from('dashboard_config')
    .select('config')
    .eq('id', CONFIG_ID)
    .single()
  if (error) { console.error('loadConfig error:', error); return null }
  return data?.config ?? null
}

export const saveConfigToDB = async (config: Record<string, unknown>) =>
  supabase
    .from('dashboard_config')
    .update({ config, updated_at: new Date().toISOString() })
    .eq('id', CONFIG_ID)

// ── User appearance ─────────────────────────────────────────
export const saveUserAppearance = async (userId: string, appearance: Record<string, unknown>) =>
  supabase.from('profiles').update({ appearance }).eq('id', userId)

export const loadUserAppearance = async (userId: string): Promise<Record<string, unknown> | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('appearance')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return data.appearance ?? null
}

// ── Create user via Edge Function ────────────────────────
export const createUser = async (
  username: string,
  password: string,
  role: Profile['role'],
  unit_id: Profile['unit_id'],
) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: { message: 'Tidak ada sesi aktif' } }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ username, password, role, unit_id }),
  })

  const data = await res.json()
  if (!res.ok) return { error: { message: data.error || 'Gagal membuat user' } }
  return { data }
}

// ── Update password via Edge Function ────────────────────
export const updateUserPassword = async (userId: string, password: string) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: { message: 'Tidak ada sesi aktif' } }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/update-user-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ userId, password }),
  })

  const data = await res.json()
  if (!res.ok) return { error: { message: data.error || 'Gagal update password' } }
  return { data }
}
