// ─────────────────────────────────────────────────────────────
// CENTRALIZED RBAC — Hierarchical Region+Unit Scope
// ─────────────────────────────────────────────────────────────
import { hasPermission, PERMISSIONS, REGIONS, UNITS } from '../types'
import type { Role, RegionScope, UnitScope, Permission } from '../types'

export { hasPermission }

// ── Session interface ─────────────────────────────────────────
export interface SessionLike {
  id?:           string
  role:          Role
  region_scope?: string
  unit_scope?:   string
  unit_id?:      string
  unitId?:       string
  full_name?:    string
  username?:     string
  initials?:     string
}

// ── Getters ───────────────────────────────────────────────────
export const getRegion = (s: SessionLike): string => s.region_scope ?? 'global'
export const getUnit   = (s: SessionLike): string =>
  s.unit_scope ?? s.unit_id ?? s.unitId ?? 'general'

// ── Generate inisial dari nama ────────────────────────────────
export const getInitials = (s: SessionLike): string => {
  if (s.initials) return s.initials.toUpperCase()
  const name = s.full_name?.trim() || s.username || ''
  const parts = name.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return '??'
}

// ── Basic permission ──────────────────────────────────────────
export const can = (session: SessionLike | null, permission: Permission): boolean => {
  if (!session) return false
  return hasPermission(session.role, permission)
}

// ── Role checks ───────────────────────────────────────────────
export const isAdminGlobal = (s: SessionLike | null): boolean =>
  s?.role === 'admin' && getRegion(s) === 'global' && getUnit(s) === 'general'

export const isAdminRegion = (s: SessionLike | null): boolean =>
  s?.role === 'admin' && getRegion(s) !== 'global' && getUnit(s) === 'general'

export const isAdminUnit = (s: SessionLike | null): boolean =>
  s?.role === 'admin' && getRegion(s) !== 'global' && getUnit(s) !== 'general'

export const isAdmin   = (s: SessionLike | null): boolean => s?.role === 'admin'
export const canEdit   = (s: SessionLike | null): boolean => can(s, 'DASHBOARD_EDIT_GLOBAL')
export const canSeeOptions = (s: SessionLike | null): boolean => true // semua user
export const canShareSection = (s: SessionLike | null): boolean => {
  if (!s || s.role !== 'admin') return false
  return getRegion(s) !== 'global' // hanya admin regional/unit
}

// ── Panduan edit — hanya admin global ────────────────────────
export const canEditPanduan = (s: SessionLike | null): boolean => isAdminGlobal(s)

// ── Coffee popup — semua kecuali admin global ─────────────────
export const shouldShowCoffee = (s: SessionLike | null): boolean => {
  if (!s) return false
  if (isAdminGlobal(s)) return false
  return true
}

// ── User management ───────────────────────────────────────────
export const canManageUser = (current: SessionLike | null, target: SessionLike): boolean => {
  if (!current) return false
  const isSelf = current.id !== undefined && current.id === target.id
  if (current.role === 'superadmin') return true

  if (current.role !== 'admin') return false
  if (isSelf) return true

  const cr = getRegion(current), cu = getUnit(current)
  const tr = getRegion(target),  tu = getUnit(target)

  // Admin global: bisa manage SEMUA user termasuk admin lain
  // KECUALI admin global lain dan superadmin
  if (isAdminGlobal(current)) {
    if (target.role === 'superadmin') return false
    if (isAdminGlobal(target) && target.id !== current.id) return false
    return true
  }

  // Admin tidak bisa manage superadmin atau admin global
  if (target.role === 'superadmin') return false
  if (isAdminGlobal(target)) return false

  // Admin regional: kelola user di regionnya (termasuk admin unit di region sama)
  if (isAdminRegion(current)) {
    return tr === cr
  }

  // Admin unit: hanya kelola user di unit+regionnya
  return tr === cr && tu === cu
}

export const canCreateUser = (current: SessionLike | null, targetRole: Role): boolean => {
  if (!current) return false
  if (current.role === 'superadmin') return true
  if (current.role !== 'admin') return false
  if (isAdminGlobal(current)) return targetRole !== 'superadmin'
  return targetRole === 'user' || targetRole === 'guest'
}

export const canAssignRole = (current: SessionLike | null, targetRole: Role): boolean => {
  if (!current) return false
  if (current.role === 'superadmin') return true
  if (current.role !== 'admin') return false
  if (isAdminGlobal(current)) return targetRole !== 'superadmin'
  return targetRole === 'user' || targetRole === 'guest'
}

export const getAllowedRegions = (current: SessionLike | null) => {
  if (!current) return []
  if (current.role === 'superadmin' || isAdminGlobal(current)) return REGIONS
  const cr = getRegion(current)
  return REGIONS.filter(r => r.value === cr)
}

export const getAllowedUnits = (current: SessionLike | null) => {
  if (!current) return []
  if (current.role === 'superadmin' || isAdminGlobal(current) || isAdminRegion(current)) return UNITS
  const cu = getUnit(current)
  return UNITS.filter(u => u.value === cu)
}

export const getAllowedRoles = (current: SessionLike | null): Role[] => {
  if (!current) return []
  if (current.role === 'superadmin') return ['superadmin', 'admin', 'user', 'guest']
  if (isAdminGlobal(current)) return ['admin', 'user', 'guest']
  if (current.role === 'admin') return ['user', 'guest']
  return []
}

// ── Section visibility ────────────────────────────────────────
export const canViewSection = (
  session: SessionLike | null,
  visibility: string,
  targetRegion: string | null,
  targetUnit:   string | null,
): boolean => {
  if (!session) return false
  if (session.role === 'superadmin' || session.role === 'admin') return true
  const userRegion = getRegion(session)
  const userUnit   = getUnit(session)
  if (visibility === 'region') return userRegion === targetRegion
  if (visibility === 'unit')   return userRegion === targetRegion && userUnit === targetUnit
  return false
}

// ── Badge labels ──────────────────────────────────────────────
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
  if (isAdminGlobal(session)) return { label: 'Admin Global', color: ROLE_BADGE_COLOR.admin }
  if (session.role === 'admin') {
    const region = getRegion(session), unit = getUnit(session)
    const regionLabel = REGION_LABELS[region] ?? region.toUpperCase()
    if (unit !== 'general') return { label: `Admin ${regionLabel} · ${UNIT_LABELS[unit] ?? unit}`, color: ROLE_BADGE_COLOR.admin }
    return { label: `Admin ${regionLabel}`, color: ROLE_BADGE_COLOR.admin }
  }
  const unit = getUnit(session), region = getRegion(session)
  if (unit && unit !== 'general') return { label: UNIT_LABELS[unit] ?? unit.toUpperCase(), color: UNIT_BADGE_COLOR[unit] ?? '#888' }
  if (region && region !== 'global') return { label: REGION_LABELS[region] ?? region.toUpperCase(), color: '#888' }
  return { label: 'User', color: '#888' }
}

export const UNIT_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'pro',     label: 'PRO'     },
  { value: 'cro',     label: 'CRO'     },
  { value: 'klaim',   label: 'Klaim'   },
  { value: 'ae',      label: 'AE'      },
]
