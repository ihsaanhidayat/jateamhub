// ─────────────────────────────────────────────────────────────
// AUTH STORE — Session lifecycle yang bersih
// Init → Login → Dashboard → Logout → Login (tanpa refresh)
// ─────────────────────────────────────────────────────────────
import { create } from 'zustand'
import { logAudit } from '../utils/supabaseClient'
import {
  supabase, getProfile, signIn, signOut, signInWithGoogle,
  createUser, getAllProfiles, getProfilesByScope,
  updateProfile, updateUserPassword,
  linkGoogleIdentity, getIdentities, unlinkIdentity,
} from '../utils/supabaseClient'
import type { Profile } from '../utils/supabaseClient'
import type { Role } from '../types'
import { canManageUser, canCreateUser, canAssignRole } from '../utils/roles'

interface AuthState {
  profile:            Profile | null
  loading:            boolean
  initialized:        boolean
  users:              Profile[]
  _usersLoaded:       boolean
  pendingGoogleUser:  { id: string; email: string } | null

  _toast: ((msg: string, type?: 'success' | 'error' | 'warn') => void) | null
  setToastFn: (fn: (msg: string, type?: 'success' | 'error' | 'warn') => void) => void

  init:                     () => Promise<void>
  login:                    (username: string, password: string) => Promise<string | null>
  loginWithGoogle:          () => Promise<void>
  completeGoogleOnboarding: (username: string, fullName: string, region: string, unit: string) => Promise<string | null>
  linkGoogle:               () => Promise<string | null>
  unlinkGoogle:             () => Promise<string | null>
  reconcileGoogleEmail:     () => Promise<void>
  logout:                   () => void

  loadUsers:   (force?: boolean) => Promise<void>
  addUser:     (username: string, password: string, role: Role, unitId: string, regionScope?: string, unitScope?: string) => Promise<string | null>
  updateUser:  (userId: string, role: Role, unitId: string, newPassword?: string, emoji?: string, regionScope?: string, unitScope?: string) => Promise<string | null>
  removeUser:  (userId: string) => Promise<string | null>
}

// Simpan subscription di luar store agar bisa cleanup
let authSubscription: { unsubscribe: () => void } | null = null
// Track pending signOut — login() harus tunggu ini selesai sebelum signIn()
let pendingSignOut: Promise<void> | null = null

export const useAuthStore = create<AuthState>((set, get) => ({
  profile:           null,
  loading:           false,
  initialized:       false,
  users:             [],
  _toast:            null,
  _usersLoaded:      false,
  pendingGoogleUser: null,

  setToastFn: (fn) => set({ _toast: fn }),

  // ── Init: cek session + setup listener ────────────────────
  init: async () => {
    set({ loading: true })

    const safetyTimer = setTimeout(() => {
      if (!get().initialized) {
        set({ profile: null, loading: false, initialized: true })
      }
    }, 8000)

    try {
      let { data: { session }, error } = await supabase.auth.getSession()

      // Jika session ada tapi expired → coba refresh dulu
      if (session && error) {
        const { data: refreshData } = await supabase.auth.refreshSession()
        session = refreshData.session
      }

      // Tidak ada session sama sekali → jangan langsung logout,
      // coba ambil user aktif dulu (handles mobile reopen)
      if (!session) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: refreshData } = await supabase.auth.refreshSession()
          session = refreshData.session
        }
      }

      clearTimeout(safetyTimer)

      if (!session?.user) {
        set({ profile: null, loading: false, initialized: true })
      } else {
        const profile = await getProfile(session.user.id)
        if (profile) {
          set({ profile, loading: false, initialized: true })
        } else {
          // Tidak ada profil — cek apakah Google OAuth user baru
          const provider = session.user.app_metadata?.provider
          if (provider === 'google') {
            set({
              pendingGoogleUser: { id: session.user.id, email: session.user.email ?? '' },
              loading: false, initialized: true,
            })
          } else {
            set({ profile: null, loading: false, initialized: true })
          }
        }
      }
    } catch {
      clearTimeout(safetyTimer)
      set({ profile: null, loading: false, initialized: true })
    }

    // Cleanup listener lama jika ada (penting untuk logout→login cycle)
    if (authSubscription) {
      authSubscription.unsubscribe()
      authSubscription = null
    }

    // Setup listener baru
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        const profile = await getProfile(session.user.id)
        if (profile) set({ profile })
      } else if (event === 'SIGNED_OUT') {
        set({ profile: null, users: [], _usersLoaded: false, pendingGoogleUser: null })
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Hanya handle Google OAuth — email/password login ditangani oleh login()
        if (get().profile) return
        const provider = session.user.app_metadata?.provider
        if (provider === 'google') {
          const profile = await getProfile(session.user.id)
          if (profile) {
            set({ profile, loading: false, initialized: true })
          } else {
            set({ pendingGoogleUser: { id: session.user.id, email: session.user.email ?? '' }, loading: false, initialized: true })
          }
        }
      }
    })
    authSubscription = subscription
  },

  // ── Login ────────────────────────────────────────────────
  login: async (username, password) => {
    set({ loading: true })
    try {
      // Tunggu signOut selesai dulu — mencegah race condition di mana
      // signOut() menghapus sesi baru yang baru saja dibuat oleh signIn()
      if (pendingSignOut) await pendingSignOut

      const email = `${username}@jateamhub.app`
      const { data, error } = await signIn(email, password)

      if (error) {
        set({ loading: false })
        return 'Username atau password salah.'
      }

      if (!data?.user) {
        set({ loading: false })
        return 'Login gagal. Coba lagi.'
      }

      const profile = await getProfile(data.user.id)
      if (!profile) {
        set({ loading: false })
        return 'Profil tidak ditemukan. Hubungi admin.'
      }

      // Sukses — set profile langsung (tidak tunggu onAuthStateChange)
      set({ profile, loading: false, initialized: true })
      void logAudit('auth.login', { metadata: { username } })
      return null
    } catch {
      set({ loading: false })
      return 'Koneksi gagal. Periksa internet.'
    }
  },

  // ── Login dengan Google ──────────────────────────────────
  loginWithGoogle: async () => {
    await signInWithGoogle()
  },

  // ── Selesaikan onboarding Google user baru ───────────────
  completeGoogleOnboarding: async (username, fullName, region, unit) => {
    const pending = get().pendingGoogleUser
    if (!pending) return 'Sesi tidak valid.'

    const { data: existing } = await supabase
      .from('profiles').select('id').eq('username', username).maybeSingle()
    if (existing) return 'Username sudah digunakan. Pilih yang lain.'

    const { error } = await supabase.from('profiles').insert({
      id:           pending.id,
      username:     username.trim().toLowerCase(),
      full_name:    fullName.trim(),
      role:         'user',
      region_scope: region,
      unit_scope:   unit,
      unit_id:      unit,
      branch_id:    '',
      avatar_emoji: '',
      avatar_url:   '',
      emoji:        '',
      appearance:   {},
      google_email: pending.email,
      auth_provider: 'google',
    })
    if (error) return error.message

    const profile = await getProfile(pending.id)
    if (!profile) return 'Gagal memuat profil. Coba lagi.'
    set({ profile, pendingGoogleUser: null, loading: false })
    return null
  },

  // ── Bind Google ke akun yang sedang login ────────────────
  // Redirect ke Google; saat kembali user tetap di profil yang sama
  // (identity Google kini menempel ke user_id ini). reconcileGoogleEmail()
  // mengisi profiles.google_email setelah kembali.
  linkGoogle: async () => {
    const me = get().profile
    if (!me) return 'Tidak ada sesi.'
    const { error } = await linkGoogleIdentity()
    if (error) {
      // Manual linking nonaktif, atau akun Google sudah terpakai user lain.
      if (/manual linking|identity is already linked|already linked|exists/i.test(error.message))
        return 'Akun Google ini sudah terhubung ke user lain, atau penautan manual belum diaktifkan.'
      return error.message
    }
    return null   // biasanya tidak tercapai — halaman sudah redirect
  },

  // ── Putuskan Google dari akun ────────────────────────────
  unlinkGoogle: async () => {
    const me = get().profile
    if (!me) return 'Tidak ada sesi.'
    const { data, error } = await getIdentities()
    if (error) return error.message
    const identities = data?.identities ?? []
    if (identities.length <= 1) return 'Tidak bisa memutuskan satu-satunya metode login.'
    const google = identities.find(i => i.provider === 'google')
    if (!google) return 'Tidak ada akun Google yang terhubung.'
    const { error: unErr } = await unlinkIdentity(google)
    if (unErr) return unErr.message
    await updateProfile(me.id, { google_email: null })
    const fresh = await getProfile(me.id)
    if (fresh) set({ profile: fresh })
    void logAudit('auth.google_unlink', {})
    return null
  },

  // ── Sinkronkan profiles.google_email dgn identity Google aktif ──
  reconcileGoogleEmail: async () => {
    const me = get().profile
    if (!me) return
    try {
      const { data } = await getIdentities()
      const google = (data?.identities ?? []).find(i => i.provider === 'google')
      const email = (google?.identity_data?.email as string | undefined) ?? null
      if (email && me.google_email !== email) {
        await updateProfile(me.id, { google_email: email })
        const fresh = await getProfile(me.id)
        if (fresh) set({ profile: fresh })
        void logAudit('auth.google_link', { metadata: { email } })
      } else if (!google && me.google_email) {
        // Identity hilang tapi profil masih menyimpan email → bersihkan.
        await updateProfile(me.id, { google_email: null })
        const fresh = await getProfile(me.id)
        if (fresh) set({ profile: fresh })
      }
    } catch { /* best effort */ }
  },

  // ── Logout ────────────────────────────────────────────────
  logout: () => {
    // Cleanup auth listener
    if (authSubscription) {
      authSubscription.unsubscribe()
      authSubscription = null
    }
    // Reset state — initialized tetap true agar langsung ke login page
    set({ profile: null, users: [], _usersLoaded: false, loading: false, pendingGoogleUser: null })
    localStorage.removeItem('jateamhub-personal')
    // Dispatch event untuk reset dashboardStore + components lain
    window.dispatchEvent(new Event('jateamhub-logout'))
    // Track promise sehingga login() bisa menunggu signOut selesai
    // sebelum memanggil signIn() — mencegah signOut menghapus sesi baru
    pendingSignOut = signOut().then(() => {}).catch(() => {}).finally(() => {
      pendingSignOut = null
      // Setup listener baru untuk login berikutnya
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          const profile = await getProfile(session.user.id)
          if (profile) set({ profile })
        } else if (event === 'SIGNED_OUT') {
          set({ profile: null, users: [], _usersLoaded: false, loading: false })
        }
      })
      authSubscription = subscription
    })
  },

  // ── Load users ────────────────────────────────────────────
  loadUsers: async (force = false) => {
    const state = get()
    const me = state.profile
    if (!me) return
    if (!force && state._usersLoaded && state.users.length > 0) return

    if (me.role === 'superadmin' ||
       (me.role === 'admin' && (me.region_scope ?? 'global') === 'global')) {
      set({ users: await getAllProfiles(), _usersLoaded: true })
    } else {
      set({ users: await getProfilesByScope(
        me.region_scope ?? 'global',
        me.unit_scope   ?? 'general'
      ), _usersLoaded: true })
    }
  },

  addUser: async (username, password, role, unitId, regionScope, unitScope) => {
    const me = get().profile
    if (!me) return 'Tidak ada sesi.'
    if (!canCreateUser(me as any, role)) return 'Tidak ada akses membuat user dengan role ini.'
    if (!canAssignRole(me as any, role)) return 'Tidak bisa assign role ini.'
    const { error } = await createUser(username, password, role, unitId, regionScope, unitScope)
    if (error) return error.message
    void logAudit('user.create', { target_type: 'user', target_label: username, metadata: { role, region_scope: regionScope, unit_scope: unitScope } })
    await get().loadUsers()
    return null
  },

  updateUser: async (userId, role, unitId, newPassword, emoji, regionScope, unitScope) => {
    const me = get().profile
    if (!me) return 'Tidak ada sesi.'
    const target = get().users.find(u => u.id === userId)
    if (!target) return 'User tidak ditemukan.'
    if (userId !== me.id && !canManageUser(me as any, target as any))
      return 'Tidak ada akses untuk edit user ini.'
    if (target.role === 'superadmin' && me.role !== 'superadmin')
      return 'Tidak bisa edit superadmin.'
    if (role !== target.role && !canAssignRole(me as any, role))
      return 'Tidak bisa assign role ini.'

    const updates: Partial<Profile> = {
      role,
      unit_id: unitId,
      unit_scope: unitScope ?? target.unit_scope ?? 'general',
      region_scope: regionScope ?? target.region_scope ?? 'global',
    }
    if (emoji !== undefined) updates.emoji = emoji

    const { error } = await updateProfile(userId, updates)
    if (error) return error.message

    if (newPassword && newPassword.length >= 6) {
      const { error: pwErr } = await updateUserPassword(userId, newPassword) as any
      if (pwErr) return pwErr.message
    }

    void logAudit('user.update', {
      target_type: 'user', target_id: userId, target_label: target.username,
      metadata: {
        ...(role !== target.role ? { role_from: target.role, role_to: role } : {}),
        password_reset: !!(newPassword && newPassword.length >= 6),
      },
    })
    await get().loadUsers()
    return null
  },

  removeUser: async (userId) => {
    const me = get().profile
    if (!me) return 'Tidak ada sesi.'
    if (userId === me.id) return 'Tidak bisa hapus akun sendiri.'
    const target = get().users.find(u => u.id === userId)
    if (!target) return 'User tidak ditemukan.'
    if (!canManageUser(me as any, target as any)) return 'Tidak ada akses hapus user ini.'
    if (target.role === 'superadmin') return 'Tidak bisa hapus superadmin.'

    const { error } = await supabase.functions.invoke('delete-user', { body: { userId } })
    if (error) await supabase.from('profiles').delete().eq('id', userId)

    void logAudit('user.delete', { target_type: 'user', target_id: userId, target_label: target.username, metadata: { role: target.role } })
    await get().loadUsers()
    return null
  },
}))
