import { create } from 'zustand'
import { supabase, getProfile, signIn, signOut, createUser, getAllProfiles, updateProfile } from '../utils/supabase'
import type { Profile } from '../utils/supabase'
import type { Role, UnitId } from '../types'

interface AuthState {
  // Session
  profile:     Profile | null
  loading:     boolean
  initialized: boolean

  // Actions
  init:        () => Promise<void>
  login:       (username: string, password: string) => Promise<string | null>
  logout:      () => Promise<void>

  // User management
  users:          Profile[]
  loadUsers:      () => Promise<void>
  addUser:        (username: string, password: string, role: Role, unitId: UnitId, adminKey: string) => Promise<string | null>
  updateUser:     (userId: string, role: Role, unitId: UnitId, newPassword?: string) => Promise<string | null>
  removeUser:     (userId: string) => Promise<string | null>

  // Toast helper (re-use dari dashboardStore)
  _toast: ((msg: string, type?: 'success' | 'error' | 'warn') => void) | null
  setToastFn: (fn: (msg: string, type?: 'success' | 'error' | 'warn') => void) => void
}

const ADMIN_KEY_DEFAULT = 'jateamhub2024'

export const useAuthStore = create<AuthState>((set, get) => ({
  profile:     null,
  loading:     false,
  initialized: false,
  users:       [],
  _toast:      null,

  setToastFn: (fn) => set({ _toast: fn }),

  // Init — dipanggil saat App mount
  init: async () => {
    set({ loading: true })
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const profile = await getProfile(session.user.id)
      set({ profile, loading: false, initialized: true })
    } else {
      set({ profile: null, loading: false, initialized: true })
    }

    // Listen auth changes
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
    const email = `${username}@jateamhub.internal`
    const { data, error } = await signIn(email, password)
    if (error) {
      set({ loading: false })
      return 'Username atau password salah.'
    }
    if (data.user) {
      const profile = await getProfile(data.user.id)
      set({ profile, loading: false })
    }
    return null
  },

  logout: async () => {
    await signOut()
    set({ profile: null })
  },

  loadUsers: async () => {
    const profiles = await getAllProfiles()
    set({ users: profiles })
  },

  addUser: async (username, password, role, unitId, adminKey) => {
    const myProfile = get().profile
    if (!myProfile) return 'Tidak ada sesi.'
    if (role === 'superadmin') return 'Role superadmin tidak bisa dibuat.'
    if (role === 'admin') {
      if (myProfile.role !== 'superadmin') return 'Hanya superadmin yang bisa membuat admin.'
      if (adminKey !== ADMIN_KEY_DEFAULT) return 'Admin key salah.'
    }
    if (myProfile.role === 'admin' && role === 'admin') return 'Admin tidak bisa membuat admin.'

    const { error } = await createUser(username, password, role, unitId)
    if (error) return error.message
    await get().loadUsers()
    return null
  },

  updateUser: async (userId, role, unitId, newPassword) => {
    const myProfile = get().profile
    if (!myProfile) return 'Tidak ada sesi.'
    if (role === 'superadmin') return 'Tidak bisa assign superadmin.'
    if (role === 'admin' && myProfile.role !== 'superadmin') return 'Hanya superadmin yang bisa assign admin.'

    const { error } = await updateProfile(userId, {
      role,
      unit_id: role === 'user' ? unitId : '',
    })
    if (error) return error.message

    // Update password jika diisi
    if (newPassword && newPassword.length >= 6) {
      const { error: pwErr } = await supabase.auth.admin.updateUserById(userId, { password: newPassword })
      if (pwErr) return pwErr.message
    }

    await get().loadUsers()
    return null
  },

  removeUser: async (userId) => {
    const myProfile = get().profile
    if (!myProfile) return 'Tidak ada sesi.'
    if (userId === myProfile.id) return 'Tidak bisa hapus akun sendiri.'

    const target = get().users.find(u => u.id === userId)
    if (target?.role === 'superadmin') return 'Tidak bisa hapus superadmin.'
    if (target?.role === 'admin' && myProfile.role !== 'superadmin') return 'Hanya superadmin yang bisa hapus admin.'

    const { error } = await supabase.functions.invoke('delete-user', { body: { userId } })
    if (error) {
      // Fallback: hapus profile saja
      await supabase.from('profiles').delete().eq('id', userId)
    }
    await get().loadUsers()
    return null
  },
}))
