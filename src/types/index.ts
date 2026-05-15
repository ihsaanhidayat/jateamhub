export interface LinkItem {
  id: string
  title: string
  url: string
  desc?: string
  icon?: string
  iconUrl?: string
  useFavicon?: boolean
  tags: string[]
  newTab: boolean
  accentColor?: string
}

export interface SectionLayout {
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export type SectionVisibility = 'all' | 'admin' | 'unit'
export type SectionType       = 'section' | 'widget'
export type WidgetType        = 'clock' | 'notes'

export interface Section {
  _expandedH?: number
  id: string
  title: string
  subtitle?: string
  icon?: string
  width: number
  items: LinkItem[]
  collapsed: boolean
  accentColor?: string
  layout: SectionLayout
  pageId: string
  // visibility system
  visibility: SectionVisibility
  targetUnits: string[]          // relevan kalau visibility='unit'
  // widget system
  type: SectionType
  widgetType?: WidgetType
  widgetData?: Record<string, unknown>
  // legacy — tetap ada untuk backward compat
  sharedRoles?: string[]
}

export interface PageConfig {
  id: string
  label: string
}

export const DEFAULT_PAGES: PageConfig[] = [
  { id: 'beranda', label: 'BERANDA' },
  { id: 'panduan', label: 'PANDUAN' },
  { id: 'support', label: 'SUPPORT' },
  { id: 'pro',     label: 'PRO'     },
  { id: 'cro',     label: 'CRO'     },
  { id: 'klaim',   label: 'KLAIM'   },
]

// Halaman yang selalu tampil untuk semua user
export const USER_PAGES = ['beranda', 'panduan', 'support']

// Admin lihat semua
export const ADMIN_PAGES = ['beranda', 'panduan', 'support', 'pro', 'cro', 'klaim']

export interface NavLink {
  label: string
  url: string
}

export interface SiteMeta {
  title: string
  subtitle: string
  adminKey: string
  nav: NavLink[]
  logoUrl?: string
}

export interface DisplayOptions {
  showTags: boolean
  showDesc: boolean
  compactHeader: boolean
}

export type ItemDisplayMode = 'button' | 'list' | 'iconText' | 'iconOnly' | 'textOnly' | 'folderGrid'
export type IconSize        = 'small' | 'medium' | 'large' | 'xl'
export type LabelMode       = 'show' | 'hide' | 'hover'
export type SectionDensity  = 'compact' | 'comfortable' | 'spacious'

export interface AppearanceSettings {
  sectionDensity: SectionDensity
  itemDisplayMode: ItemDisplayMode
  iconSize: IconSize
  labelMode: LabelMode
  tooltipEnabled: boolean
  faviconEnabled: boolean
  itemGridMinWidth: number
  folderGridCols: number
}

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  sectionDensity:  'comfortable',
  itemDisplayMode: 'button',
  iconSize:        'medium',
  labelMode:       'show',
  tooltipEnabled:  true,
  faviconEnabled:  true,
  itemGridMinWidth: 72,
  folderGridCols:  3,
}

export interface JateamConfig {
  version: string
  meta: SiteMeta
  displayOptions: DisplayOptions
  appearance: AppearanceSettings
  sections: Section[]
  pages: PageConfig[]
}

// Role hanya 3
export type Role   = 'superadmin' | 'admin' | 'user'
export type UnitId = 'pro' | 'cro' | 'klaim' | ''

export interface UserAccount {
  username: string
  password: string
  role: Role
  unitId?: UnitId
}

export interface UserSession {
  username: string
  role: Role
  unitId?: UnitId
  remember: 'never' | 'session' | 'always'
}

export interface Preset {
  id: string
  name: string
  ts: number
}

export type GridBreakpoint = 'lg' | 'md' | 'sm' | 'xs' | 'xxs'

export const GRID_COLS: Record<GridBreakpoint, number> = {
  lg: 12, md: 8, sm: 4, xs: 2, xxs: 1,
}
export const GRID_BREAKPOINTS: Record<GridBreakpoint, number> = {
  lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0,
}
export const GRID_ROW_HEIGHT = 40
export const SECTION_MIN_W   = 2
export const SECTION_MIN_H   = 4
export const SECTION_DEFAULT_W = 4
export const SECTION_DEFAULT_H = 8

export const ICON_SIZE_MAP: Record<IconSize, { wrapper: number; img: number }> = {
  small:  { wrapper: 28, img: 16 },
  medium: { wrapper: 36, img: 22 },
  large:  { wrapper: 48, img: 30 },
  xl:     { wrapper: 60, img: 40 },
}

export type SizeMode   = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type LayoutMode = 'default' | 'minimal' | 'compact' | 'wide'
