// ─────────────────────────────────────────────
// CENTRALIZED PERMISSION SYSTEM
// ─────────────────────────────────────────────
import { hasPermission, PERMISSIONS } from '../types'
import type { Role, UnitId, Permission } from '../types'

export { hasPermission }

// ── Compatible session interface ──────────────
export interface SessionLike {
  role:    Role
  unit_id?: UnitId
  unitId?:  UnitId
}

const getUnit = (s: SessionLike): UnitId =>
  (s.unit_id ?? s.unitId ?? '') as UnitId

// ── Permission helpers ────────────────────────
export const can = (session: SessionLike | null, permission: Permission): boolean => {
  if (!session) return false
  return hasPermission(session.role, permission)
}

export const canEdit = (session: SessionLike | null): boolean =>
  can(session, 'DASHBOARD_EDIT_GLOBAL')

export const canEditUnit = (session: SessionLike | null): boolean =>
  can(session, 'DASHBOARD_EDIT_UNIT')

export const canCreateUser = (session: SessionLike | null): boolean =>
  can(session, 'USER_CREATE')

export const canResetPassword = (session: SessionLike | null): boolean =>
  can(session, 'USER_RESET_PASSWORD')

export const canSelfPassword = (session: SessionLike | null): boolean =>
  can(session, 'USER_SELF_PASSWORD')

export const canUseEmojiAvatar = (session: SessionLike | null): boolean =>
  can(session, 'APPEARANCE_EMOJI_AVATAR')

export const canSeeOptionsPanel = (session: SessionLike | null): boolean =>
  can(session, 'APPEARANCE_OPTIONS_PANEL')

export const canSeeBadge = (session: SessionLike | null): boolean =>
  can(session, 'BADGE_VISIBILITY')

export const canEditGlobal = (session: SessionLike | null): boolean =>
  can(session, 'SECTION_EDIT_GLOBAL')

export const canEditUnitSection = (
  session: SessionLike | null,
  sectionTargetUnits: string[],
): boolean => {
  if (!session) return false
  if (can(session, 'SECTION_EDIT_GLOBAL')) return true
  if (session.role === 'admin_unit') {
    const unit = getUnit(session)
    return unit !== '' && sectionTargetUnits.includes(unit)
  }
  return false
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
    return targetUnits.includes(unit)
  }
  return false
}

// ── Accessible pages ──────────────────────────
export const getAccessiblePages = (session: SessionLike | null): string[] => {
  // Semua role dapat beranda
  return ['beranda']
}

// ── Display badge ─────────────────────────────
export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super Admin',
  admin:      'Admin',
  admin_unit: 'Unit Admin',
  user:       'User',
}

export const ROLE_BADGE_COLOR: Record<Role, string> = {
  superadmin: '#FF6B6B',
  admin:      '#00BFFF',
  admin_unit: '#C77DFF',
  user:       '#888',
}

export const UNIT_LABELS: Record<string, string> = {
  '':     'User Umum',
  pro:    'PRO',
  cro:    'CRO',
  klaim:  'Klaim',
}

export const UNIT_BADGE_COLOR: Record<string, string> = {
  '':     '#888',
  pro:    '#00FFC2',
  cro:    '#FFD93D',
  klaim:  '#FF8C42',
}

export const UNIT_OPTIONS = [
  { value: '' as UnitId,      label: 'Tidak ada unit (user umum)' },
  { value: 'pro' as UnitId,   label: 'PRO' },
  { value: 'cro' as UnitId,   label: 'CRO' },
  { value: 'klaim' as UnitId, label: 'Klaim' },
]

export const getDisplayBadge = (session: SessionLike | null) => {
  if (!session) return { label: 'Guest', color: '#888' }
  const unit = getUnit(session)
  if (session.role === 'superadmin') return { label: 'Super Admin', color: ROLE_BADGE_COLOR.superadmin }
  if (session.role === 'admin')      return { label: 'Admin',       color: ROLE_BADGE_COLOR.admin }
  if (unit) return { label: UNIT_LABELS[unit] ?? unit.toUpperCase(), color: UNIT_BADGE_COLOR[unit] ?? '#888' }
  return { label: 'User', color: '#888' }
}

// ── Role descriptions ─────────────────────────
export const ROLE_DESC: Record<Role, string> = {
  superadmin: 'Full access seluruh sistem',
  admin:      'Kelola dashboard & user',
  admin_unit: 'Kelola unit sendiri saja',
  user:       'Akses fitur utama',
}
