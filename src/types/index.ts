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

// ── Theme ─────────────────────────────────────
// 2 tema: Ivory (light, professional) + Obsidian (dark, standalone)
export type ThemeBase = 'ivory' | 'obsidian'
export type ThemeId =
  | ThemeBase
  | 'ivory-light'
  // Legacy compat — semua map ke ivory atau obsidian
  | 'aurora-light' | 'aurora-dark' | 'aurora'
  | 'sand-light'   | 'sand-dark'   | 'sand'
  | 'slate-light'  | 'slate-dark'  | 'slate'
  | 'pearl-light'  | 'pearl-dark'  | 'pearl'
  | 'dark-mint' | 'dark-soft' | 'enterprise'

export interface ThemeConfig {
  id:          ThemeBase
  name:        string
  description: string
  accent:      string
  bgLight:     string
  bgDark:      string
  font:        string
  standalone?: boolean
}

export const THEMES: ThemeConfig[] = [
  {
    id:          'ivory',
    name:        'Ivory',
    description: 'Clean · Professional · Light',
    accent:      '#2563EB',
    bgLight:     '#FAFAF8',
    bgDark:      '#FAFAF8',
    font:        'Plus Jakarta Sans',
  },
  {
    id:          'obsidian',
    name:        'Obsidian',
    description: 'Dark · Elegant · Focused',
    accent:      '#6EE7B7',
    bgLight:     '#0E0E0E',
    bgDark:      '#0E0E0E',
    font:        'Space Grotesk',
    standalone:  true,
  },
]

// Terapkan tema ke DOM: set data-theme + font otomatis
export const applyThemeToElement = (base: ThemeBase, _isDark: boolean) => {
  const theme = THEMES.find(t => t.id === base) ?? THEMES[0]
  const themeId = base === 'obsidian' ? 'obsidian' : 'ivory-light'
  const root = document.documentElement
  root.setAttribute('data-theme', themeId)
  // Load font jika belum
  const fontName = theme.font.replace(' ', '+')
  if (!document.querySelector(`link[href*="${fontName}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`
    document.head.appendChild(link)
  }
  root.style.setProperty('--font', `'${theme.font}', sans-serif`)
}

// ── Section ───────────────────────────────────
export type SectionVisibility = 'all' | 'admin' | 'unit'
export type WidgetType  = 'clock' | 'notes'
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
  isFavorite?: boolean  // item ini di-pin sebagai favorit
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
  isFavorite?:  boolean  // section ini di-pin sebagai favorit
}



// ── Appearance ────────────────────────────────
export type IconSize       = 'small' | 'medium' | 'large' | 'xl'
export type LabelMode      = 'show' | 'hide' | 'hover'
export type ItemDisplayMode = 'button' | 'list' | 'iconText' | 'folderGrid'
export type ColorMode      = 'dark' | 'light'
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
  themeBase:        ThemeBase   // tema aktif: pearl/ivory/sage/obsidian
  isDarkMode:       boolean     // toggle dark mode
  sectionDensity?:  SectionDensity
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  itemDisplayMode: 'folderGrid',
  iconSize:        'large',
  labelMode:       'show',
  folderGridCols:  4,
  tooltipEnabled:  true,
  faviconEnabled:  true,
  colorMode:       'light',
  theme:           'ivory-light' as ThemeId,
  themeBase:       'ivory',
  isDarkMode:      false,
}

// ── Display options ───────────────────────────
export interface DisplayOptions { showDesc: boolean; showTags: boolean }
export const defaultDisplayOptions: DisplayOptions = { showDesc: true, showTags: false }

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
  displayOptions: DisplayOptions
  presets:        Preset[]
}

// ── Grid constants ────────────────────────────
// GRID_ROW_HEIGHT: tinggi 1 baris grid dalam pixel
export const GRID_ROW_HEIGHT   = 60  // 60px per baris — 3 baris = 180px
// Default lebar: 4 kolom (3 section × 4 = 12 kolom penuh di layar)
export const SECTION_MIN_W     = 1
export const SECTION_MIN_H     = 2
export const SECTION_DEFAULT_W = 4
// Default tinggi: h:3 = 3×60 = 180px — muat 3 baris icon large (44px+label)
export const SECTION_DEFAULT_H = 3
