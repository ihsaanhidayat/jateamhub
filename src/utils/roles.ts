// ─────────────────────────────────────────────
// CENTRALIZED RBAC — Hierarchical Region+Unit
// ─────────────────────────────────────────────
import { hasPermission, PERMISSIONS, REGIONS, UNITS } from '../types'
import type { Role, RegionScope, UnitScope, Permission } from '../types'

export { hasPermission }

// ── Session interface ─────────────────────────
export interface SessionLike {
  id?:           string
  role:          Role
  region_scope?: RegionScope | string
  unit_scope?:   UnitScope   | string
  // legacy compat
  unit_id?:      string
  unitId?:       string
}

// ── Getters ───────────────────────────────────
export const getRegion = (s: SessionLike): string => s.region_scope ?? 'global'
export const getUnit   = (s: SessionLike): string =>
  s.unit_scope ?? s.unit_id ?? s.unitId ?? 'general'

// ── Basic permission ──────────────────────────
export const can = (session: SessionLike | null, permission: Permission): boolean => {
  if (!session) return false
  return hasPermission(session.role, permission)
}

// ── Role checks ───────────────────────────────
export const isSuperAdmin  = (s: SessionLike | null) => s?.role === 'superadmin'
export const isAdmin       = (s: SessionLike | null) => s?.role === 'admin' || s?.role === 'superadmin'
export const isAdminGlobal = (s: SessionLike | null) => isAdmin(s) && getRegion(s!) === 'global'
export const isAdminRegion = (s: SessionLike | null) => isAdmin(s) && getRegion(s!) !== 'global' && getUnit(s!) === 'general'
export const isAdminUnit   = (s: SessionLike | null) => isAdmin(s) && getRegion(s!) !== 'global' && getUnit(s!) !== 'general'

export const canEdit         = (s: SessionLike | null) => can(s, 'DASHBOARD_EDIT_GLOBAL')
export const canSeeOptions   = (s: SessionLike | null) => can(s, 'APPEARANCE_OPTIONS_PANEL')
export const canSeeBadge     = (s: SessionLike | null) => can(s, 'BADGE_VISIBILITY')
export const canUseEmoji     = (s: SessionLike | null) => can(s, 'APPEARANCE_EMOJI_AVATAR')
export const canResetPwd     = (s: SessionLike | null) => can(s, 'USER_RESET_PASSWORD')
export const canSelfPwd      = (s: SessionLike | null) => can(s, 'USER_RESET_PASSWORD')
export const canManageUsers  = (s: SessionLike | null) => can(s, 'USER_CREATE')

// ── User management helpers ───────────────────
export const canManageUser = (current: SessionLike | null, target: SessionLike): boolean => {
  if (!current) return false
  if (current.role === 'superadmin') return true
  if (current.role !== 'admin') return false
  // Admin tidak bisa manage superadmin atau admin lain
  if (target.role === 'superadmin' || target.role === 'admin') return false
  const cr = getRegion(current), cu = getUnit(current)
  const tr = getRegion(target),  tu = getUnit(target)
  // Global admin — bisa semua user
  if (cr === 'global' && cu === 'general') return true
  // Regional admin — sama region
  if (cr !== 'global' && cu === 'general') return tr === cr
  // Regional+unit admin — sama region dan unit
  return tr === cr && tu === cu
}

export const canCreateUser = (current: SessionLike | null, targetRole: Role): boolean => {
  if (!current) return false
  if (current.role === 'superadmin') return true
  if (current.role !== 'admin') return false
  return targetRole === 'user' || targetRole === 'guest'
}

export const canAssignRole = (current: SessionLike | null, targetRole: Role): boolean => {
  if (!current) return false
  if (current.role === 'superadmin') return true
  if (current.role === 'admin') return targetRole === 'user' || targetRole === 'guest'
  return false
}

export const canAssignRegion = (current: SessionLike | null, targetRegion: string): boolean => {
  if (!current) return false
  if (current.role === 'superadmin') return true
  const cr = getRegion(current)
  if (current.role === 'admin' && cr === 'global') return true
  if (current.role === 'admin') return targetRegion === cr
  return false
}

export const canAssignUnit = (current: SessionLike | null, targetUnit: string): boolean => {
  if (!current) return false
  if (current.role === 'superadmin') return true
  if (current.role !== 'admin') return false
  const cu = getUnit(current)
  if (cu === 'general') return true
  return targetUnit === cu
}

export const getAllowedRegions = (current: SessionLike | null) => {
  if (!current) return []
  if (current.role === 'superadmin') return REGIONS
  const cr = getRegion(current)
  if (current.role === 'admin' && cr === 'global') return REGIONS
  return REGIONS.filter(r => r.value === cr || r.value === 'global')
}

export const getAllowedUnits = (current: SessionLike | null) => {
  if (!current) return []
  if (current.role === 'superadmin') return UNITS
  const cu = getUnit(current)
  if (cu === 'general') return UNITS
  return UNITS.filter(u => u.value === cu)
}

export const getAllowedRoles = (current: SessionLike | null): Role[] => {
  if (!current) return []
  if (current.role === 'superadmin') return ['superadmin', 'admin', 'user', 'guest']
  if (current.role === 'admin') return ['user', 'guest']
  return []
}

// ── Section visibility ────────────────────────
export const canViewSection = (
  session: SessionLike | null,
  visibility: string,
  targetUnits: string[],
): boolean => {
  if (!session) return false
  if (session.role === 'superadmin' || session.role === 'admin') return true
  if (visibility === 'all')   return true
  if (visibility === 'admin') return false
  if (visibility === 'unit') {
    const unit = getUnit(session)
    return targetUnits.includes(unit) || targetUnits.includes(session.unit_id ?? '')
  }
  return false
}

// ── Display badge ─────────────────────────────
export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super Admin',
  admin:      'Admin',
  user:       'User',
  guest:      'Guest',
}
export const ROLE_BADGE_COLOR: Record<Role, string> = {
  superadmin: '#FF6B6B',
  admin:      '#00BFFF',
  user:       '#888',
  guest:      '#666',
}
export const UNIT_LABELS: Record<string, string> = {
  general: 'General', pro: 'PRO', cro: 'CRO', klaim: 'Klaim', ae: 'AE', '': 'User',
}
export const UNIT_BADGE_COLOR: Record<string, string> = {
  general: '#888', pro: '#00FFC2', cro: '#FFD93D', klaim: '#FF8C42', ae: '#A78BFA', '': '#888',
}
export const REGION_LABELS: Record<string, string> = {
  global: 'Global', sby: 'Surabaya', mks: 'Makassar', jkt: 'Jakarta',
  dps: 'Denpasar', mdn: 'Medan', pkb: 'Pekanbaru', plb: 'Palembang',
  btk: 'Botabek', bdg: 'Bandung', smg: 'Semarang', bpn: 'Balikpapan',
}

export const getDisplayBadge = (session: SessionLike | null) => {
  if (!session) return { label: 'Guest', color: '#666' }
  if (session.role === 'superadmin') return { label: 'Super Admin', color: ROLE_BADGE_COLOR.superadmin }
  if (session.role === 'admin') {
    const region = getRegion(session)
    const unit   = getUnit(session)
    if (region === 'global') return { label: 'Admin Global', color: ROLE_BADGE_COLOR.admin }
    const regionLabel = REGION_LABELS[region] ?? region.toUpperCase()
    if (unit !== 'general') return { label: `Admin ${regionLabel} · ${UNIT_LABELS[unit] ?? unit}`, color: ROLE_BADGE_COLOR.admin }
    return { label: `Admin ${regionLabel}`, color: ROLE_BADGE_COLOR.admin }
  }
  const unit = getUnit(session)
  const region = getRegion(session)
  if (unit && unit !== 'general') return { label: UNIT_LABELS[unit] ?? unit.toUpperCase(), color: UNIT_BADGE_COLOR[unit] ?? '#888' }
  if (region && region !== 'global') return { label: REGION_LABELS[region] ?? region.toUpperCase(), color: '#888' }
  return { label: 'User', color: '#888' }
}

// ── Legacy compat ─────────────────────────────
export const UNIT_OPTIONS = [
  { value: '',      label: 'Tidak ada unit' },
  { value: 'pro',   label: 'PRO'            },
  { value: 'cro',   label: 'CRO'            },
  { value: 'klaim', label: 'Klaim'          },
  { value: 'ae',    label: 'AE'             },
]
export const ROLE_DESC: Record<Role, string> = {
  superadmin: 'Full access seluruh sistem',
  admin:      'Kelola user & dashboard sesuai scope',
  user:       'Akses fitur utama',
  guest:      'Akses terbatas, tidak tersimpan',
}
