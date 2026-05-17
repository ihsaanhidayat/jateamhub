// ─────────────────────────────────────────────────────────────
// AUTH STORE — State management autentikasi dan user management
// Superadmin: hanya user management, zero section access
// Admin: scope-aware user management berdasarkan region + unit
// ─────────────────────────────────────────────────────────────
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
  profile:     Profile | null   // profil user yang sedang login
  loading:     boolean           // sedang proses login/init
  initialized: boolean           // inisialisasi auth sudah selesai
  users:       Profile[]         // daftar user untuk management

  // Fungsi inject toast dari dashboard store
  _toast: ((msg: string, type?: 'success' | 'error' | 'warn') => void) | null
  setToastFn: (fn: (msg: string, type?: 'success' | 'error' | 'warn') => void) => void

  // Auth actions
  init:    () => Promise<void>
  login:   (username: string, password: string) => Promise<string | null>
  logout:  () => void

  // User management actions
  loadUsers:   () => Promise<void>
  addUser:     (username: string, password: string, role: Role, unitId: string, regionScope?: string, unitScope?: string) => Promise<string | null>
  updateUser:  (userId: string, role: Role, unitId: string, newPassword?: string, emoji?: string, regionScope?: string, unitScope?: string) => Promise<string | null>
  removeUser:  (userId: string) => Promise<string | null>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile:     null,
  loading:     false,
  initialized: false,
  users:       [],
  _toast:      null,

  // Simpan referensi fungsi toast dari dashboard store
  setToastFn: (fn) => set({ _toast: fn }),

  // ── Inisialisasi: cek sesi aktif saat app dibuka ──────────
  init: async () => {
    set({ loading: true })
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session?.user) {
        // Sesi tidak valid atau tidak ada — bersihkan storage
        if (error) {
          localStorage.removeItem('jateamhub-personal')
          await supabase.auth.signOut()
        }
        set({ profile: null, loading: false, initialized: true })
      } else {
        const profile = await getProfile(session.user.id)
        set({ profile, loading: false, initialized: true })
      }
    } catch {
      // Fallback — token corrupt atau network error
      set({ profile: null, loading: false, initialized: true })
    }

    // Dengarkan perubahan status auth
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        if (session?.user) {
          const profile = await getProfile(session.user.id)
          set({ profile })
        }
      } else if (event === 'SIGNED_OUT') {
        set({ profile: null })
      }
    })
  },

  // ── Login: konversi username → email format jateamhub ─────
  login: async (username, password) => {
    set({ loading: true })
    const email = `${username}@jateamhub.app`
    const { data, error } = await signIn(email, password)
    if (error) { set({ loading: false }); return 'Username atau password salah.' }
    if (data.user) {
      const profile = await getProfile(data.user.id)
      set({ profile, loading: false })
    }
    return null // null = tidak ada error
  },

  // ── Logout: optimistic — UI clear dulu, signOut di background ──
  logout: () => {
    // Clear state SEGERA tanpa tunggu network
    set({ profile: null, users: [] })
    localStorage.removeItem('jateamhub-personal')
    // SignOut di background — tidak perlu await
    signOut().catch(() => {/* ignore */})
  },

  // ── Load users berdasarkan scope admin yang login ──────────
  loadUsers: async () => {
    const me = get().profile
    if (!me) return

    // Superadmin dan admin global → load semua user
    if (me.role === 'superadmin' ||
       (me.role === 'admin' && (me.region_scope ?? 'global') === 'global')) {
      set({ users: await getAllProfiles() })
    } else {
      // Admin wilayah/unit → hanya load user dalam scope-nya
      set({ users: await getProfilesByScope(
        me.region_scope ?? 'global',
        me.unit_scope   ?? 'general'
      )})
    }
  },

  // ── Tambah user baru — validasi permission dulu ───────────
  addUser: async (username, password, role, unitId, regionScope, unitScope) => {
    const me = get().profile
    if (!me) return 'Tidak ada sesi.'

    // Cek apakah boleh membuat user dengan role ini
    if (!canCreateUser(me as any, role))  return 'Tidak ada akses membuat user dengan role ini.'
    if (!canAssignRole(me as any, role))  return 'Tidak bisa assign role ini.'

    const { error } = await createUser(username, password, role, unitId, regionScope, unitScope)
    if (error) return error.message

    await get().loadUsers()
    return null
  },

  // ── Update user — validasi permission dan scope ───────────
  updateUser: async (userId, role, unitId, newPassword, emoji, regionScope, unitScope) => {
    const me     = get().profile
    if (!me) return 'Tidak ada sesi.'
    const target = get().users.find(u => u.id === userId)
    if (!target) return 'User tidak ditemukan.'

    // Tidak boleh edit diri sendiri melalui user management
    // kecuali untuk reset password (dihandle terpisah)
    if (userId !== me.id && !canManageUser(me as any, target as any))
      return 'Tidak ada akses untuk edit user ini.'

    // Tidak boleh downgrade/upgrade superadmin
    if (target.role === 'superadmin' && me.role !== 'superadmin')
      return 'Tidak bisa edit superadmin.'

    // Tidak boleh assign role yang lebih tinggi dari diri sendiri
    if (role !== target.role && !canAssignRole(me as any, role))
      return 'Tidak bisa assign role ini.'

    // Update data profil
    const updates: Partial<Profile> = {
      role,
      unit_id:      unitId,
      unit_scope:   unitScope   ?? target.unit_scope   ?? 'general',
      region_scope: regionScope ?? target.region_scope ?? 'global',
    }
    if (emoji !== undefined) updates.emoji = emoji

    const { error } = await updateProfile(userId, updates)
    if (error) return error.message

    // Update password jika diisi dan panjang minimal 6
    if (newPassword && newPassword.length >= 6) {
      const { error: pwErr } = await updateUserPassword(userId, newPassword) as any
      if (pwErr) return pwErr.message
    }

    await get().loadUsers()
    return null
  },

  // ── Hapus user — validasi permission ──────────────────────
  removeUser: async (userId) => {
    const me = get().profile
    if (!me) return 'Tidak ada sesi.'
    if (userId === me.id) return 'Tidak bisa hapus akun sendiri.'

    const target = get().users.find(u => u.id === userId)
    if (!target) return 'User tidak ditemukan.'
    if (!canManageUser(me as any, target as any)) return 'Tidak ada akses hapus user ini.'
    if (target.role === 'superadmin') return 'Tidak bisa hapus superadmin.'

    // Hapus via Edge Function (butuh service role key)
    const { error } = await supabase.functions.invoke('delete-user', { body: { userId } })
    // Fallback: hapus langsung dari profiles jika edge function gagal
    if (error) await supabase.from('profiles').delete().eq('id', userId)

    await get().loadUsers()
    return null
  },
}))
