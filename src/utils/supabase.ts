// v2
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://qsvrqdnyjywjzxkqwszl.supabase.co'
const SUPABASE_ANON = 'sb_publishable_wzaKkf02vmfOvqIb3wHgKQ_mZgecfAn'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

// ── Types ────────────────────────────────────────────────
export interface Profile {
  id: string
  username: string
  role: 'superadmin' | 'admin' | 'user'
  unit_id: '' | 'pro' | 'cro' | 'klaim'
  created_at: string
}

// ── Auth helpers ─────────────────────────────────────────
export const signIn = async (email: string, password: string) => {
  return supabase.auth.signInWithPassword({ email, password })
}

export const signOut = async () => {
  return supabase.auth.signOut()
}

export const getSession = async () => {
  return supabase.auth.getSession()
}

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
  updates: Partial<Pick<Profile, 'role' | 'unit_id' | 'username'>>
) => {
  return supabase.from('profiles').update(updates).eq('id', userId)
}

export const deleteProfile = async (userId: string) => {
  // Hapus dari auth.users — cascade ke profiles
  return supabase.auth.admin.deleteUser(userId)
}

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

export const saveConfigToDB = async (config: Record<string, unknown>) => {
  return supabase
    .from('dashboard_config')
    .update({ config, updated_at: new Date().toISOString() })
    .eq('id', CONFIG_ID)
}

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
