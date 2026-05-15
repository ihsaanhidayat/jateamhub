import type { UserSession, UnitId, Role } from '../types'
import { USER_PAGES, ADMIN_PAGES } from '../types'

export type { Role, UnitId }

// Unit display info
export const UNIT_LABELS: Record<string, string> = {
  pro:   'PRO',
  cro:   'CRO',
  klaim: 'Klaim',
  '':    'User',
}

export const UNIT_BADGE_COLOR: Record<string, string> = {
  pro:   '#C77DFF',
  cro:   '#FF9F40',
  klaim: '#FF6B6B',
  '':    '#999999',
}

// Role display info
export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super Admin',
  admin:      'Admin',
  user:       'User',
}

export const ROLE_BADGE_COLOR: Record<Role, string> = {
  superadmin: '#00FFC2',
  admin:      '#00BFFF',
  user:       '#999999',
}

export const ROLE_DESC: Record<Role, string> = {
  superadmin: 'Godmode — semua akses + kelola admin & semua role',
  admin:      'Edit dashboard + kelola users',
  user:       'Read-only, akses sesuai unit',
}

// Badge label di options panel — tampilkan unit kalau ada, role kalau tidak
export const getDisplayBadge = (session: UserSession | null): { label: string; color: string } => {
  if (!session) return { label: 'Guest', color: '#555' }
  if (session.role === 'superadmin') return { label: 'Super Admin', color: ROLE_BADGE_COLOR.superadmin }
  if (session.role === 'admin')      return { label: 'Admin',       color: ROLE_BADGE_COLOR.admin }
  // user — tampilkan unit
  const unit = session.unitId ?? ''
  return {
    label: UNIT_LABELS[unit] ?? 'User',
    color: UNIT_BADGE_COLOR[unit] ?? '#999',
  }
}

// Halaman yang bisa diakses berdasarkan session
export const getAccessiblePages = (session: UserSession | null): string[] => {
  if (!session) return USER_PAGES
  // Admin & superadmin: hanya BERANDA, PANDUAN, SUPPORT di navbar
  // PRO/CRO/KLAIM dikelola via section visibility — tidak perlu halaman terpisah di navbar
  if (session.role === 'superadmin' || session.role === 'admin') return USER_PAGES
  // user → beranda, panduan, support saja di navbar
  return USER_PAGES
}

export const canAccessPage = (session: UserSession | null, pageId: string): boolean =>
  getAccessiblePages(session).includes(pageId)

// Permission checks
export const canEdit        = (s: UserSession | null) => s?.role === 'superadmin' || s?.role === 'admin'
export const canCreateUser  = (s: UserSession | null) => s?.role === 'superadmin' || s?.role === 'admin'
export const canCreateAdmin = (s: UserSession | null) => s?.role === 'superadmin'
export const isSuperAdmin   = (s: UserSession | null) => s?.role === 'superadmin'
export const isAdmin        = (s: UserSession | null) => s?.role === 'admin'

// Roles yang bisa dibuat admin
export const ADMIN_CREATABLE_ROLES: Role[] = ['user']
export const SUPERADMIN_CREATABLE_ROLES: Role[] = ['admin', 'user']

// Unit options
export const UNIT_OPTIONS: { value: UnitId; label: string }[] = [
  { value: '',      label: 'Tidak ada unit (user umum)' },
  { value: 'pro',   label: 'PRO' },
  { value: 'cro',   label: 'CRO' },
  { value: 'klaim', label: 'Klaim' },
]

// Cek apakah section boleh tampil untuk session ini
export const canViewSection = (
  session: UserSession | null,
  visibility: string,
  targetUnits: string[],
): boolean => {
  if (!session) return false
  // Admin & superadmin lihat semua
  if (session.role === 'superadmin' || session.role === 'admin') return true
  // User
  if (visibility === 'all')   return true
  if (visibility === 'admin') return false
  if (visibility === 'unit')  return targetUnits.includes(session.unitId ?? '')
  return false
}
