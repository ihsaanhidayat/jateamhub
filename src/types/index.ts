// ─────────────────────────────────────────────
// JATEAMHUB — TYPE DEFINITIONS v5.0
// ─────────────────────────────────────────────

// ── Roles ────────────────────────────────────
export type Role = 'superadmin' | 'admin' | 'user' | 'guest'

// ── Scope ────────────────────────────────────
export type RegionScope = 'global' | 'sby' | 'mks' | 'jkt' | 'dps' | 'mdn' | 'pkb' | 'plb' | 'btk' | 'bdg' | 'smg' | 'bpn'
export type UnitScope   = 'general' | 'pro' | 'cro' | 'klaim' | 'ae'
export type UnitId      = '' | 'pro' | 'cro' | 'klaim' // legacy compat

// ── Region & Unit constants ───────────────────
export const REGIONS = [
  { label: 'Global',      value: 'global' },
  { label: 'Surabaya',    value: 'sby'    },
  { label: 'Makassar',    value: 'mks'    },
  { label: 'Jakarta',     value: 'jkt'    },
  { label: 'Denpasar',    value: 'dps'    },
  { label: 'Medan',       value: 'mdn'    },
  { label: 'Pekanbaru',   value: 'pkb'    },
  { label: 'Palembang',   value: 'plb'    },
  { label: 'Botabek',     value: 'btk'    },
  { label: 'Bandung',     value: 'bdg'    },
  { label: 'Semarang',    value: 'smg'    },
  { label: 'Balikpapan',  value: 'bpn'    },
] as const

export const UNITS = [
  { label: 'General', value: 'general' },
  { label: 'PRO',     value: 'pro'     },
  { label: 'CRO',     value: 'cro'     },
  { label: 'Klaim',   value: 'klaim'   },
  { label: 'AE',      value: 'ae'      },
] as const

// ── RBAC Permissions ─────────────────────────
export const PERMISSIONS = {
  SYSTEM_CONFIG:           ['superadmin'],
  SYSTEM_THEME_GLOBAL:     ['superadmin'],
  USER_CREATE:             ['superadmin', 'admin'],
  USER_READ_ALL:           ['superadmin', 'admin'],
  USER_UPDATE_ROLE:        ['superadmin'],
  USER_RESET_PASSWORD:     ['superadmin', 'admin'],
  USER_DELETE:             ['superadmin', 'admin'],
  DASHBOARD_EDIT_GLOBAL:   ['superadmin', 'admin'],
  SECTION_EDIT_GLOBAL:     ['superadmin', 'admin'],
  APPEARANCE_THEME_GLOBAL: ['superadmin'],
  APPEARANCE_EMOJI_AVATAR: ['superadmin', 'admin'],
  APPEARANCE_OPTIONS_PANEL:['superadmin', 'admin', 'user', 'guest'], // semua role bisa akses options
  BADGE_VISIBILITY:        ['superadmin', 'admin'],
} as const

export type Permission = keyof typeof PERMISSIONS

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role)
}

// ── Theme (simplified — Pearl/Slate via CSS vars) ─────────
export type ThemeId = string  // legacy compat: 'pearl' | 'slate'

// ── Section ───────────────────────────────────
export type SectionVisibility = 'all' | 'admin' | 'unit'
export type WidgetType  = 'clock' | 'notes' | 'todo' | 'calendar' | 'password'
export type SectionType = 'section' | 'widget'
export interface SectionLayout { x: number; y: number; w: number; h: number }

export interface LinkItem {
  id:          string
  title:       string
  url:         string
  icon:        string
  desc:        string
  tags:        string[]
  newTab:      boolean
  iconUrl?:    string
  useFavicon?: boolean
}

export interface Section {
  id:           string
  title:        string
  icon:         string
  subtitle:     string
  items:        LinkItem[]
  layout:       SectionLayout
  _expandedH?:  number
  collapsed?:   boolean
  visibility:   SectionVisibility
  targetUnits:  string[]
  pageId:       string
  accentColor?: string
  type?:        SectionType
  widgetType?:  WidgetType
  updatedAt?:   number   // ms timestamp of the last content edit
}

// ── Appearance ────────────────────────────────
export type IconSize       = 'small' | 'medium' | 'large' | 'xl'
export type ItemDisplayMode = 'folderGrid' | 'list'
export type ColorMode      = 'dark' | 'light'
export type SectionDensity = 'compact' | 'comfortable' | 'spacious'

export interface AppearanceSettings {
  itemDisplayMode:  ItemDisplayMode
  iconSize:         IconSize
  folderGridCols:   number
  tooltipEnabled:   boolean
  faviconEnabled:   boolean
  colorMode:        ColorMode
  theme:            ThemeId
  isDarkMode:       boolean     // toggle dark mode
  sectionDensity?:  SectionDensity
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  itemDisplayMode: 'folderGrid',
  iconSize:        'large',
  folderGridCols:  5,
  tooltipEnabled:  true,
  faviconEnabled:  true,
  colorMode:       'light',
  theme:           'parchment',
  isDarkMode:      false,
}

// ── Display options ───────────────────────────

// ── Icon size map ─────────────────────────────
export const ICON_SIZE_MAP: Record<string, { wrapper: number; img: number }> = {
  small:  { wrapper: 28, img: 18 },
  medium: { wrapper: 36, img: 24 },
  large:  { wrapper: 48, img: 34 },  // ideal touch target
  xl:     { wrapper: 60, img: 44 },
}

// ── Pages ─────────────────────────────────────
export interface PageDef { id: string; label: string }
export const DEFAULT_PAGES: PageDef[] = [{ id: 'beranda', label: 'BERANDA' }]

// ── Config ────────────────────────────────────
export interface MetaConfig {
  title: string; subtitle: string; logoUrl: string
  coffeeUrl: string; adminKey: string
}
export interface Preset { id: string; name: string; appearance: AppearanceSettings }
export interface JateamConfig {
  version:        string
  meta:           MetaConfig
  pages:          PageDef[]
  sections:       Section[]
  appearance:     AppearanceSettings
  presets:        Preset[]
}

// ── Grid constants ────────────────────────────
// GRID_ROW_HEIGHT: tinggi 1 baris grid dalam pixel
export const GRID_ROW_HEIGHT   = 60  // 60px per baris — 3 baris = 180px
// Default lebar: 4 kolom (3 section × 4 = 12 kolom penuh di layar)
export const SECTION_MIN_W     = 1
export const SECTION_MIN_H     = 2
export const SECTION_DEFAULT_W = 3   // 4 section per baris di 12 cols
// Default tinggi: h:3 = 3×60 = 180px — muat 3 baris icon large (44px+label)
export const SECTION_DEFAULT_H = 3

export interface TodoItem {
  id:        string
  text:      string
  done:      boolean
  createdAt: number       // ms timestamp
  doneAt?:   number       // ms timestamp saat selesai
  dueTime?:  string       // 'HH:MM' jam due di hari yang sama
  date:      string       // 'YYYY-MM-DD' tanggal task dibuat
}

// kind 'event' → a dated red marker (optional time); 'note' → plain activity.
// Legacy entries (kind 'todo' or undefined) are treated as 'event'.
export type CalendarKind = 'event' | 'note'
export interface CalendarEvent {
  id:        string
  date:      string            // 'YYYY-MM-DD'
  title:     string
  time?:     string            // 'HH:MM' optional
  color?:    'accent' | 'red' | 'green' | 'yellow'
  kind?:     CalendarKind
  done?:     boolean
  doneAt?:   number
  createdAt: number
}

// ── Password vault ────────────────────────────
// Stored ENCRYPTED (base64 iv‖ciphertext) inside the widget's items[0].desc.
// Never persisted in plaintext anywhere.
export interface VaultEntry {
  id:        string
  label:     string            // site / app name
  username:  string            // login / email
  password:  string
  url?:      string
  note?:     string
  updatedAt: number            // ms timestamp
}

export interface TodoHistory {
  id:           string
  user_id:      string
  task_text:    string
  due_date?:    string
  status:       'done' | 'overdue'
  created_at:   string
  done_at?:     string
  date:         string
}
