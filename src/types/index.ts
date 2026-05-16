// ─────────────────────────────────────────────
// JATEAMHUB — TYPE DEFINITIONS
// ─────────────────────────────────────────────

// ── Roles ────────────────────────────────────
export type Role = 'superadmin' | 'admin' | 'admin_unit' | 'user'
export type UnitId = '' | 'pro' | 'cro' | 'klaim'

// ── RBAC Permissions ─────────────────────────
export const PERMISSIONS = {
  // System
  SYSTEM_CONFIG:        ['superadmin'],
  SYSTEM_THEME_GLOBAL:  ['superadmin'],
  SYSTEM_FEATURE:       ['superadmin'],

  // User management
  USER_CREATE:          ['superadmin', 'admin'],
  USER_CREATE_UNIT:     ['superadmin', 'admin', 'admin_unit'],
  USER_READ_ALL:        ['superadmin', 'admin'],
  USER_UPDATE_ROLE:     ['superadmin'],
  USER_RESET_PASSWORD:  ['superadmin', 'admin'],
  USER_SELF_PASSWORD:   ['superadmin', 'admin'],
  USER_DELETE:          ['superadmin', 'admin'],

  // Dashboard edit
  DASHBOARD_EDIT_GLOBAL: ['superadmin', 'admin'],
  DASHBOARD_EDIT_UNIT:   ['superadmin', 'admin', 'admin_unit'],

  // Section
  SECTION_EDIT_GLOBAL:  ['superadmin', 'admin'],
  SECTION_EDIT_UNIT:    ['superadmin', 'admin', 'admin_unit'],

  // Appearance
  APPEARANCE_THEME_GLOBAL: ['superadmin'],
  APPEARANCE_EMOJI_AVATAR: ['superadmin', 'admin'],
  APPEARANCE_PERSONAL:     ['superadmin', 'admin', 'admin_unit', 'user'],
  APPEARANCE_OPTIONS_PANEL:['superadmin', 'admin', 'admin_unit'],

  // Content
  CONTENT_PANDUAN_EDIT: ['superadmin', 'admin'],
  BADGE_VISIBILITY:     ['superadmin', 'admin'],
} as const

export type Permission = keyof typeof PERMISSIONS

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role)
}

// ── Theme ─────────────────────────────────────
export type ThemeId = 'dark-mint' | 'dark-soft' | 'enterprise'
export interface ThemeConfig {
  id: ThemeId
  name: string
  bg: string
  accent: string
  description: string
}
export const THEMES: ThemeConfig[] = [
  { id: 'dark-mint',   name: 'Dark Mint',   bg: '#0A0A0A', accent: '#00FFC2', description: 'Default — hitam pekat dengan aksen mint' },
  { id: 'dark-soft',   name: 'Dark Soft',   bg: '#0d1117', accent: '#6366f1', description: 'Navy gelap dengan aksen indigo' },
  { id: 'enterprise',  name: 'Enterprise',  bg: '#111827', accent: '#f59e0b', description: 'Charcoal profesional dengan aksen amber' },
]

// ── Section ───────────────────────────────────
export type SectionVisibility = 'all' | 'admin' | 'unit'
export type WidgetType = 'clock' | 'notes'
export type SectionType = 'section' | 'widget'
export interface SectionLayout { x: number; y: number; w: number; h: number }

export interface LinkItem {
  id:         string
  title:      string
  url:        string
  icon:       string
  desc:       string
  tags:       string[]
  newTab:     boolean
  iconUrl?:   string
  useFavicon?: boolean
}

export interface Section {
  id:          string
  title:       string
  icon:        string
  subtitle:    string
  items:       LinkItem[]
  layout:      SectionLayout
  _expandedH?: number
  collapsed?:  boolean
  visibility:  SectionVisibility
  targetUnits: string[]
  pageId:      string
  accentColor?: string
  type?:       SectionType
  widgetType?: WidgetType
}

// ── Appearance ────────────────────────────────
export type IconSize      = 'small' | 'medium' | 'large' | 'xl'
export type LabelMode     = 'show'  | 'hide'   | 'hover'
export type ItemDisplayMode = 'button' | 'list' | 'iconText' | 'folderGrid'
export type ColorMode     = 'dark' | 'light'

export type SectionDensity = 'compact' | 'comfortable' | 'spacious'

export interface AppearanceSettings {
  itemDisplayMode:  ItemDisplayMode
  iconSize:         IconSize
  labelMode:        LabelMode
  folderGridCols:   number
  tooltipEnabled:   boolean
  faviconEnabled:   boolean
  colorMode:        ColorMode
  theme:            ThemeId
  sectionDensity?:  SectionDensity  // kept for backward compat
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  itemDisplayMode: 'folderGrid',
  iconSize:        'large',
  labelMode:       'show',
  folderGridCols:  4,
  tooltipEnabled:  true,
  faviconEnabled:  true,
  colorMode:       'dark',
  theme:           'dark-mint',
}

// ── DisplayOptions ────────────────────────────
export interface DisplayOptions {
  showDesc: boolean
  showTags: boolean
}
export const defaultDisplayOptions: DisplayOptions = {
  showDesc: true,
  showTags: false,
}

// ── Pages ─────────────────────────────────────
export interface PageDef { id: string; label: string }
export const DEFAULT_PAGES: PageDef[] = [
  { id: 'beranda', label: 'BERANDA' },
]

// ── Config ────────────────────────────────────
export interface MetaConfig {
  title:    string
  subtitle: string
  logoUrl:  string
  coffeeUrl: string
  adminKey: string
}

export interface Preset {
  id:   string
  name: string
  appearance: AppearanceSettings
}

export interface JateamConfig {
  version:        string
  meta:           MetaConfig
  pages:          PageDef[]
  sections:       Section[]
  appearance:     AppearanceSettings
  displayOptions: DisplayOptions
  presets:        Preset[]
}

// ── Icon size map ────────────────────────────────
export const ICON_SIZE_MAP: Record<string, { wrapper: number; img: number }> = {
  small:  { wrapper: 24, img: 16 },
  medium: { wrapper: 30, img: 20 },
  large:  { wrapper: 38, img: 28 },
  xl:     { wrapper: 48, img: 36 },
}

// ── Grid constants ────────────────────────────
export const GRID_ROW_HEIGHT   = 70
export const SECTION_MIN_W     = 2
export const SECTION_MIN_H     = 3
export const SECTION_DEFAULT_W = 3
export const SECTION_DEFAULT_H = 5

// ── User pages (visible to all) ───────────────
export const USER_PAGES = ['beranda']
