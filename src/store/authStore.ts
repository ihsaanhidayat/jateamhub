import { create } from 'zustand'
import {
  supabase, getProfile, signIn, signOut,
  createUser, getAllProfiles, getProfilesByScope,
  updateProfile, updateUserPassword,
} from '../utils/supabaseClient'
import type { Profile } from '../utils/supabaseClient'
import type { Role } from '../types'
import { canManageUser, canCreateUser, canAssignRole, getRegion, getUnit } from '../utils/roles'

interface AuthState {
  profile:     Profile | null
  loading:     boolean
  initialized: boolean
  users:       Profile[]
  _toast: ((msg: string, type?: 'success' | 'error' | 'warn') => void) | null
  setToastFn:  (fn: (msg: string, type?: 'success' | 'error' | 'warn') => void) => void
  init:        () => Promise<void>
  login:       (username: string, password: string) => Promise<string | null>
  logout:      () => Promise<void>
  loadUsers:   () => Promise<void>
  addUser:     (username: string, password: string, role: Role, unitId: string, regionScope?: string, unitScope?: string) => Promise<string | null>
  updateUser:  (userId: string, role: Role, unitId: string, newPassword?: string, emoji?: string, regionScope?: string, unitScope?: string) => Promise<string | null>
  removeUser:  (userId: string) => Promise<string | null>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null, loading: false, initialized: false, users: [], _toast: null,

  setToastFn: (fn) => set({ _toast: fn }),

  init: async () => {
    set({ loading: true })
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const profile = await getProfile(session.user.id)
      set({ profile, loading: false, initialized: true })
    } else {
      set({ profile: null, loading: false, initialized: true })
    }
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await getProfile(session.user.id)
        set({ profile })
      } else {
        set({ profile: null })
      }
    })
  },

  login: async (username, password) => {
    set({ loading: true })
    const email = `${username}@jateamhub.app`
    const { data, error } = await signIn(email, password)
    if (error) { set({ loading: false }); return 'Username atau password salah.' }
    if (data.user) {
      const profile = await getProfile(data.user.id)
      set({ profile, loading: false })
    }
    return null
  },

  logout: async () => { await signOut(); set({ profile: null }) },

  loadUsers: async () => {
    const me = get().profile
    if (!me) return
    if (me.role === 'superadmin' || (me.role === 'admin' && (me.region_scope ?? 'global') === 'global')) {
      set({ users: await getAllProfiles() })
    } else {
      set({ users: await getProfilesByScope(me.region_scope ?? 'global', me.unit_scope ?? 'general') })
    }
  },

  addUser: async (username, password, role, unitId, regionScope, unitScope) => {
    const me = get().profile
    if (!me) return 'Tidak ada sesi.'
    if (!canCreateUser(me as any, role)) return 'Tidak ada akses untuk membuat user dengan role ini.'
    if (!canAssignRole(me as any, role)) return 'Tidak bisa assign role ini.'
    const { error } = await createUser(username, password, role, unitId, regionScope, unitScope)
    if (error) return error.message
    await get().loadUsers()
    return null
  },

  updateUser: async (userId, role, unitId, newPassword, emoji, regionScope, unitScope) => {
    const me = get().profile
    if (!me) return 'Tidak ada sesi.'
    const target = get().users.find(u => u.id === userId)
    if (!target) return 'User tidak ditemukan.'

    if (userId !== me.id && !canManageUser(me as any, target as any)) return 'Tidak ada akses untuk edit user ini.'
    if (target.role === 'superadmin' && me.role !== 'superadmin') return 'Tidak bisa edit superadmin.'
    if (role !== target.role && !canAssignRole(me as any, role)) return 'Tidak bisa assign role ini.'

    const updates: Partial<Profile> = {
      role,
      unit_id:      unitId,
      unit_scope:   unitScope  ?? target.unit_scope  ?? 'general',
      region_scope: regionScope ?? target.region_scope ?? 'global',
    }
    if (emoji !== undefined) updates.emoji = emoji

    const { error } = await updateProfile(userId, updates)
    if (error) return error.message

    if (newPassword && newPassword.length >= 6) {
      const { error: pwErr } = await updateUserPassword(userId, newPassword) as any
      if (pwErr) return pwErr.message
    }

    await get().loadUsers()
    return null
  },

  removeUser: async (userId) => {
    const me = get().profile
    if (!me) return 'Tidak ada sesi.'
    if (userId === me.id) return 'Tidak bisa hapus akun sendiri.'
    const target = get().users.find(u => u.id === userId)
    if (!target) return 'User tidak ditemukan.'
    if (!canManageUser(me as any, target as any)) return 'Tidak ada akses untuk hapus user ini.'
    if (target.role === 'superadmin') return 'Tidak bisa hapus superadmin.'
    const { error } = await supabase.functions.invoke('delete-user', { body: { userId } })
    if (error) await supabase.from('profiles').delete().eq('id', userId)
    await get().loadUsers()
    return null
  },
}))
