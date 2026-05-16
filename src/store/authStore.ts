import { create } from 'zustand'
import {
  supabase, getProfile, signIn, signOut,
  createUser, getAllProfiles, getUnitProfiles,
  updateProfile, updateUserPassword,
} from '../utils/supabaseClient'
import type { Profile } from '../utils/supabaseClient'
import type { Role, UnitId } from '../types'
import { can } from '../utils/roles'

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
  addUser:     (username: string, password: string, role: Role, unitId: UnitId) => Promise<string | null>
  updateUser:  (userId: string, role: Role, unitId: UnitId, newPassword?: string, avatarEmoji?: string) => Promise<string | null>
  removeUser:  (userId: string) => Promise<string | null>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile:     null,
  loading:     false,
  initialized: false,
  users:       [],
  _toast:      null,

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

  logout: async () => {
    await signOut()
    set({ profile: null })
  },

  loadUsers: async () => {
    const myProfile = get().profile
    if (!myProfile) return
    // admin_unit hanya lihat user di unitnya
    if (myProfile.role === 'admin_unit') {
      const profiles = await getUnitProfiles(myProfile.unit_id)
      set({ users: profiles })
    } else {
      const profiles = await getAllProfiles()
      set({ users: profiles })
    }
  },

  addUser: async (username, password, role, unitId) => {
    const myProfile = get().profile
    if (!myProfile) return 'Tidak ada sesi.'

    // Permission check
    if (role === 'superadmin') return 'Role superadmin tidak bisa dibuat.'
    if (role === 'admin' && myProfile.role !== 'superadmin') return 'Hanya superadmin yang bisa membuat admin.'
    if (myProfile.role === 'admin_unit') {
      // admin_unit hanya bisa buat user di unitnya
      if (role !== 'user') return 'Admin unit hanya bisa membuat user biasa.'
      if (unitId !== myProfile.unit_id) return 'Admin unit hanya bisa membuat user di unitnya.'
    }

    const { error } = await createUser(username, password, role, unitId)
    if (error) return error.message
    await get().loadUsers()
    return null
  },

  updateUser: async (userId, role, unitId, newPassword, avatarEmoji) => {
    const myProfile = get().profile
    if (!myProfile) return 'Tidak ada sesi.'
    const target = get().users.find(u => u.id === userId)

    // Permission checks
    if (role === 'superadmin' && target?.role !== 'superadmin') return 'Tidak bisa assign superadmin.'
    if (target?.role === 'superadmin' && role !== 'superadmin')  return 'Tidak bisa ubah role superadmin.'
    if (role === 'admin' && myProfile.role !== 'superadmin')     return 'Hanya superadmin yang bisa assign admin.'
    if (myProfile.role === 'admin_unit' && target?.unit_id !== myProfile.unit_id) return 'Tidak bisa edit user unit lain.'

    // Update profile
    if (target?.role !== 'superadmin') {
      const updates: Partial<Profile> = { role, unit_id: unitId }
      if (avatarEmoji !== undefined && can({ role: myProfile.role }, 'APPEARANCE_EMOJI_AVATAR')) {
        updates.avatar_emoji = avatarEmoji
      }
      const { error } = await updateProfile(userId, updates)
      if (error) return error.message
    } else {
      if (avatarEmoji !== undefined) {
        await updateProfile(userId, { avatar_emoji: avatarEmoji })
      }
    }

    // Update password — hanya superadmin dan admin
    if (newPassword && newPassword.length >= 6) {
      if (!can({ role: myProfile.role }, 'USER_RESET_PASSWORD')) return 'Tidak ada akses untuk reset password.'
      const { error } = await updateUserPassword(userId, newPassword)
      if (error) return error.message
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
    if (myProfile.role === 'admin_unit' && target?.unit_id !== myProfile.unit_id) return 'Tidak bisa hapus user unit lain.'

    const { error } = await supabase.functions.invoke('delete-user', { body: { userId } })
    if (error) await supabase.from('profiles').delete().eq('id', userId)
    await get().loadUsers()
    return null
  },
}))
