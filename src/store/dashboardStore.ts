import { create } from 'zustand'
import type {
  JateamConfig, UserSession, UserAccount, Preset,
  DisplayOptions, Section, SectionLayout, AppearanceSettings, LinkItem,
  Role, UnitId
} from '../types'
import {
  DEFAULT_APPEARANCE, SECTION_DEFAULT_W, SECTION_DEFAULT_H,
  SECTION_MIN_W, SECTION_MIN_H, DEFAULT_PAGES, USER_PAGES
} from '../types'
import { uid } from '../utils/helpers'
import { sanitizeRole, sanitizePage } from '../utils/security'

const DATA_KEY   = 'jateamhub-data'
const AUTH_KEY   = 'jateamhub-auth'
const USERS_KEY  = 'jateamhub-users'
const PRESET_KEY = 'jateamhub-presets'
const ADMIN_KEY_DEFAULT = 'jateamhub2024'
const COLLAPSED_H = 1
const CONFIG_VERSION = '4.0'

// Migrate section lama ke struktur baru
const migrateSection = (s: Section): Section => ({
  ...s,
  subtitle:    s.subtitle    ?? '',
  sharedRoles: s.sharedRoles ?? [],
  visibility:  s.visibility  ?? (s.sharedRoles?.length ? 'unit' : 'all'),
  targetUnits: s.targetUnits ?? (s.sharedRoles ?? []),
  type:        s.type        ?? 'section',
  widgetType:  s.widgetType,
  collapsed:   s.collapsed   ?? false,
  pageId:      s.pageId      ?? 'beranda',
  _expandedH:  s._expandedH  ?? (s.collapsed ? SECTION_DEFAULT_H : (s.layout?.h ?? SECTION_DEFAULT_H)),
})

const autoLayout = (sections: Section[]): Section[] => {
  let col = 0, row = 0
  const cols = 12
  const result: Section[] = []
  for (const s of sections) {
    const migrated = migrateSection(s)
    const w = migrated.layout?.w ?? SECTION_DEFAULT_W
    const h = migrated.layout?.h ?? SECTION_DEFAULT_H
    const layout = migrated.layout ?? { x: col, y: row, w, h }
    col += w
    if (col >= cols) { col = 0; row += h }
    result.push({
      ...migrated,
      layout: { ...layout, minW: SECTION_MIN_W, minH: SECTION_MIN_H },
    })
  }
  return result
}

const defaultDisplayOptions: DisplayOptions = { showTags: false, showDesc: true, compactHeader: false }

const mkSections = (): Section[] => autoLayout([
  {
    id: 's1', title: 'LAYANAN BERSAMA', subtitle: 'Layanan internal perusahaan',
    icon: '🌐', width: 280, collapsed: false, accentColor: undefined,
    layout: { x: 0, y: 0, w: SECTION_DEFAULT_W, h: SECTION_DEFAULT_H },
    pageId: 'beranda', visibility: 'all', targetUnits: [],
    type: 'section', items: [
      { id: 'i1', title: 'Email Korporat',  url: 'https://mail.google.com',     desc: 'Gmail perusahaan', icon: '', tags: ['email'], newTab: true },
      { id: 'i2', title: 'Jateam Jira',     url: 'https://jira.atlassian.com',  desc: '', icon: '', tags: [], newTab: true },
      { id: 'i3', title: 'Kalender',         url: 'https://calendar.google.com', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i4', title: 'JIRA',             url: 'https://jira.atlassian.com',  desc: '', icon: '', tags: [], newTab: true },
      { id: 'i5', title: 'APPS',             url: 'https://workspace.google.com', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i6', title: 'Office 365',       url: 'https://office.com',          desc: '', icon: '', tags: [], newTab: true },
    ],
  },
  {
    id: 's2', title: 'ADMIN PANEL', subtitle: 'Manajemen sistem',
    icon: '⚙️', width: 280, collapsed: false, accentColor: undefined,
    layout: { x: 4, y: 0, w: SECTION_DEFAULT_W, h: SECTION_DEFAULT_H },
    pageId: 'beranda', visibility: 'admin', targetUnits: [],
    type: 'section', items: [
      { id: 'i7',  title: 'PAM',            url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i8',  title: 'Usma',           url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i9',  title: 'Usma 2',         url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i10', title: 'Usma 3',         url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i11', title: 'Gemini',         url: 'https://gemini.google.com', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i12', title: 'Edit Dashboard', url: '#', desc: '', icon: '', tags: [], newTab: true },
    ],
  },
  {
    id: 's3', title: 'MONITORING', subtitle: '',
    icon: '📊', width: 280, collapsed: false, accentColor: undefined,
    layout: { x: 8, y: 0, w: SECTION_DEFAULT_W, h: SECTION_DEFAULT_H },
    pageId: 'beranda', visibility: 'admin', targetUnits: [],
    type: 'section', items: [
      { id: 'i13', title: 'RJTP',            url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i14', title: 'COB',             url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i15', title: 'PKS',             url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i16', title: 'Less Config',     url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i17', title: 'UR',              url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i18', title: 'Rekap Efisiensi', url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i19', title: 'Big Cases',       url: '#', desc: '', icon: '', tags: [], newTab: true },
    ],
  },
  {
    id: 's4', title: 'FEEDING', subtitle: '',
    icon: '📡', width: 280, collapsed: false, accentColor: undefined,
    layout: { x: 0, y: 8, w: SECTION_DEFAULT_W, h: SECTION_DEFAULT_H },
    pageId: 'beranda', visibility: 'admin', targetUnits: [],
    type: 'section', items: [
      { id: 'i20', title: 'COB 2024',   url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i21', title: 'Analisa',    url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i22', title: 'Matrix C',   url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i23', title: 'UC',         url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i24', title: 'Morbrief',   url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i25', title: 'Status K',   url: '#', desc: '', icon: '', tags: [], newTab: true },
      { id: 'i26', title: 'Efisiensi',  url: '#', desc: '', icon: '', tags: [], newTab: true },
    ],
  },
])

const defaultConfig: JateamConfig = {
  version: CONFIG_VERSION,
  meta: {
    title: 'JateamHub', subtitle: 'Selamat datang, {username}',
    adminKey: ADMIN_KEY_DEFAULT, logoUrl: '',
    nav: [
      { label: 'BERANDA', url: '#' }, { label: 'PANDUAN', url: '#' },
      { label: 'SUPPORT', url: '#' }, { label: 'PRO',     url: '#' },
      { label: 'CRO',     url: '#' }, { label: 'KLAIM',   url: '#' },
    ],
  },
  displayOptions: defaultDisplayOptions,
  appearance: { ...DEFAULT_APPEARANCE },
  sections: mkSections(),
  pages: [...DEFAULT_PAGES],
}

const defaultUsers: UserAccount[] = [
  { username: 'superadmin', password: 'admin123',  role: 'superadmin', unitId: '' },
  { username: 'admin',      password: 'admin456',  role: 'admin',      unitId: '' },
  { username: 'user',       password: 'user123',   role: 'user',       unitId: '' },
]

// ── storage ──────────────────────────────────────────────
const loadConfig = (): JateamConfig => {
  try {
    const d = localStorage.getItem(DATA_KEY)
    if (!d) return structuredClone(defaultConfig)
    const p = JSON.parse(d)
    const savedMajor   = String(p.version ?? '0').split('.')[0]
    const currentMajor = CONFIG_VERSION.split('.')[0]
    if (savedMajor !== currentMajor) {
      console.info('[JateamHub] Config version mismatch, resetting.')
      localStorage.removeItem(DATA_KEY)
      return structuredClone(defaultConfig)
    }
    p.sections       = autoLayout(p.sections || [])
    p.displayOptions = { ...defaultDisplayOptions, ...(p.displayOptions ?? {}) }
    p.appearance     = { ...DEFAULT_APPEARANCE,    ...(p.appearance    ?? {}) }
    p.meta           = { ...defaultConfig.meta,    ...(p.meta          ?? {}) }
    p.pages          = (Array.isArray(p.pages) && p.pages.length > 0) ? p.pages : [...DEFAULT_PAGES]
    return p
  } catch (e) {
    console.error('[JateamHub] Config load failed, resetting.', e)
    localStorage.removeItem(DATA_KEY)
    return structuredClone(defaultConfig)
  }
}

const persist = (cfg: JateamConfig) => localStorage.setItem(DATA_KEY, JSON.stringify(cfg))

const loadUsers = (): UserAccount[] => {
  try {
    const u = localStorage.getItem(USERS_KEY)
    if (!u || JSON.parse(u).length === 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers))
      return defaultUsers
    }
    const users: UserAccount[] = JSON.parse(u)
    // Migrate: role lama pro/cro/klaim → user + unitId
    return users.map(u => {
      if (u.role === ('pro' as string))   return { ...u, role: 'user' as Role, unitId: 'pro'   as UnitId }
      if (u.role === ('cro' as string))   return { ...u, role: 'user' as Role, unitId: 'cro'   as UnitId }
      if (u.role === ('klaim' as string)) return { ...u, role: 'user' as Role, unitId: 'klaim' as UnitId }
      if (u.username === 'admin' && u.role === ('admin' as string) && !u.unitId) return u
      return { ...u, unitId: u.unitId ?? '' }
    })
  } catch {
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers))
    return defaultUsers
  }
}

const saveUsers   = (u: UserAccount[]) => localStorage.setItem(USERS_KEY, JSON.stringify(u))
const loadPresets = (): Preset[] => { try { const p = localStorage.getItem(PRESET_KEY); return p ? JSON.parse(p) : [] } catch { return [] } }
const savePresets = (p: Preset[]) => localStorage.setItem(PRESET_KEY, JSON.stringify(p))

const loadSession = (): UserSession | null => {
  try {
    const s = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY)
    if (!s) return null
    const sess = JSON.parse(s)
    sess.role   = sanitizeRole(sess.role) as Role
    sess.unitId = sess.unitId ?? ''
    return sess
  } catch { return null }
}

// ── store interface ──────────────────────────────────────
interface DashboardStore {
  session: UserSession | null
  initSession: () => void
  login:    (u: string, p: string, r: UserSession['remember']) => string | null
  register: (u: string, p: string, role: Role, unitId: UnitId, key: string) => string | null
  logout:   () => void
  getUsers:           () => UserAccount[]
  updateUser:         (username: string, role: Role, unitId: UnitId, newPassword?: string) => string | null
  deleteUser:         (username: string) => string | null

  config: JateamConfig
  setConfig:   (cfg: JateamConfig) => void
  resetConfig: () => void

  addSection:          (title: string, icon: string, subtitle: string, accentColor?: string, visibility?: string, targetUnits?: string[], pageId?: string, type?: string, widgetType?: string) => void
  updateSection:       (id: string, title: string, icon: string, subtitle: string, width: number, accentColor?: string, pageId?: string, visibility?: string, targetUnits?: string[]) => void
  deleteSection:       (id: string) => void
  toggleCollapse:      (id: string) => void
  updateSectionLayout: (id: string, layout: SectionLayout) => void
  batchUpdateLayouts:  (layouts: Array<{ id: string; layout: SectionLayout }>) => void
  resetLayout:         () => void

  addItem:    (sectionId: string, data: Omit<LinkItem, 'id'>) => void
  updateItem: (sectionId: string, itemId: string, data: Omit<LinkItem, 'id'>) => void
  deleteItem: (sectionId: string, itemId: string) => void
  moveItem:   (srcSectionId: string, itemId: string, tgtSectionId: string, tgtItemId?: string) => void

  editMode: boolean
  toggleEditMode: () => void
  searchQuery: string
  setSearch: (q: string) => void
  currentPage: string
  setCurrentPage: (page: string) => void
  // Preview mode — admin bisa preview + edit tampilan unit lain
  previewUnit: string | null
  setPreviewUnit: (unit: string | null) => void
  // Undo / Redo
  history: JateamConfig[]
  future:  JateamConfig[]
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  displayOptions:    DisplayOptions
  setDisplayOptions: (o: Partial<DisplayOptions>) => void
  appearance:        AppearanceSettings
  setAppearance:     (o: Partial<AppearanceSettings>) => void

  presets:       Preset[]
  savePreset:    (name: string) => void
  applyPreset:   (id: string) => void
  deletePreset:  (id: string) => void

  toasts: { id: string; msg: string; type: 'success' | 'error' | 'warn' }[]
  toast:       (msg: string, type?: 'success' | 'error' | 'warn') => void
  removeToast: (id: string) => void
}

// Max history steps
const MAX_HISTORY = 20

// Push current config ke history sebelum mutasi
const pushHistory = (get: () => DashboardStore, set: (s: Partial<DashboardStore>) => void) => {
  const { config, history } = get()
  const newHistory = [...history, structuredClone(config)].slice(-MAX_HISTORY)
  set({ history: newHistory, future: [] })
}

export const useStore = create<DashboardStore>((set, get) => ({
  // ── auth ────────────────────────────────────────────────
  session: null,
  initSession: () => { const s = loadSession(); if (s) set({ session: s }) },

  login: (username, password, remember) => {
    const found = loadUsers().find(u => u.username === username && u.password === password)
    if (!found) return 'Username atau password salah.'
    const session: UserSession = { username, role: found.role, unitId: found.unitId ?? '', remember }
    const data = JSON.stringify(session)
    if (remember === 'always') localStorage.setItem(AUTH_KEY, data)
    else sessionStorage.setItem(AUTH_KEY, data)
    set({ session, currentPage: 'beranda', previewUnit: null })
    return null
  },

  register: (username, password, role, unitId, key) => {
    const adminKey = get().config.meta.adminKey || ADMIN_KEY_DEFAULT
    const session  = get().session
    if (!username || !password) return 'Username dan password wajib diisi.'
    if (password.length < 6)    return 'Password minimal 6 karakter.'
    if (role === 'superadmin')  return 'Role superadmin tidak bisa didaftarkan.'
    if (role === 'admin') {
      if (session?.role !== 'superadmin') return 'Hanya superadmin yang bisa membuat admin.'
      if (key !== adminKey) return 'Admin key salah.'
    }
    const canCreate = session?.role === 'superadmin' || session?.role === 'admin'
    if (!canCreate) return 'Tidak ada izin.'
    if (session?.role === 'admin' && role === 'admin') return 'Admin tidak bisa membuat admin.'
    const users = loadUsers()
    if (users.find(u => u.username === username)) return 'Username sudah digunakan.'
    users.push({ username, password, role, unitId })
    saveUsers(users); return null
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(AUTH_KEY)
    set({ session: null, editMode: false, previewUnit: null })
  },

  getUsers: () => loadUsers(),

  updateUser: (username, role, unitId, newPassword) => {
    const session = get().session
    if (username === session?.username && role !== session.role) return 'Tidak bisa ubah role diri sendiri.'
    if (role === 'superadmin') return 'Tidak bisa assign superadmin.'
    if (role === 'admin' && session?.role !== 'superadmin') return 'Hanya superadmin yang bisa assign admin.'
    const users = loadUsers()
    const target = users.find(u => u.username === username)
    if (!target) return 'User tidak ditemukan.'
    if (target.role === 'superadmin' && session?.role !== 'superadmin') return 'Tidak bisa ubah superadmin.'
    target.role   = role
    target.unitId = unitId
    if (newPassword && newPassword.length >= 6) target.password = newPassword
    else if (newPassword && newPassword.length > 0) return 'Password minimal 6 karakter.'
    saveUsers(users); return null
  },

  deleteUser: (username) => {
    const session = get().session
    if (username === session?.username) return 'Tidak bisa hapus akun sendiri.'
    const users = loadUsers()
    const target = users.find(u => u.username === username)
    if (!target) return 'User tidak ditemukan.'
    if (target.role === 'superadmin') return 'Tidak bisa hapus superadmin.'
    if (target.role === 'admin' && session?.role !== 'superadmin') return 'Hanya superadmin yang bisa hapus admin.'
    saveUsers(users.filter(u => u.username !== username)); return null
  },

  // ── config ───────────────────────────────────────────────
  config: loadConfig(),
  setConfig: (cfg) => {
    cfg.appearance     = { ...DEFAULT_APPEARANCE, ...(cfg.appearance   ?? {}) }
    cfg.sections       = autoLayout(cfg.sections || [])
    cfg.displayOptions = { ...defaultDisplayOptions, ...(cfg.displayOptions ?? {}) }
    cfg.pages          = (Array.isArray(cfg.pages) && cfg.pages.length > 0) ? cfg.pages : [...DEFAULT_PAGES]
    persist(cfg); set({ config: cfg, appearance: cfg.appearance, displayOptions: cfg.displayOptions })
  },
  resetConfig: () => {
    const fresh = structuredClone(defaultConfig)
    persist(fresh)
    set({ config: fresh, appearance: fresh.appearance, displayOptions: fresh.displayOptions, currentPage: 'beranda', previewUnit: null })
  },

  // ── sections ─────────────────────────────────────────────
  addSection: (title, icon, subtitle, accentColor, visibility = 'all', targetUnits = [], pageId, type = 'section', widgetType) => {
    pushHistory(get, set)
    const cfg    = structuredClone(get().config)
    const maxY   = cfg.sections.reduce((m, s) => Math.max(m, s.layout.y + s.layout.h), 0)
    const lastRowSections = cfg.sections.filter(s => s.layout.y + s.layout.h === maxY)
    const lastX  = lastRowSections.length > 0
      ? Math.max(...lastRowSections.map(s => s.layout.x + s.layout.w)) % 12
      : 0
    const resolvedPageId = pageId ?? get().currentPage
    cfg.sections.push({
      id: 's' + uid(), title, subtitle, icon: icon || (type === 'widget' ? '🧩' : '📁'),
      width: 280, collapsed: false, accentColor, _expandedH: SECTION_DEFAULT_H,
      layout: { x: lastX, y: maxY - SECTION_DEFAULT_H, w: SECTION_DEFAULT_W, h: SECTION_DEFAULT_H, minW: SECTION_MIN_W, minH: SECTION_MIN_H },
      pageId: resolvedPageId, visibility: visibility as 'all' | 'admin' | 'unit',
      targetUnits, type: type as 'section' | 'widget', widgetType: widgetType as 'clock' | 'notes' | undefined,
      items: [],
    })
    persist(cfg); set({ config: cfg })
  },

  updateSection: (id, title, icon, subtitle, width, accentColor, pageId, visibility, targetUnits) => {
    pushHistory(get, set)
    const cfg = structuredClone(get().config)
    const s = cfg.sections.find(s => s.id === id)
    if (s) {
      s.title = title; s.subtitle = subtitle; s.icon = icon; s.width = width
      s.accentColor = accentColor
      if (pageId)      s.pageId      = pageId
      if (visibility)  s.visibility  = visibility as 'all' | 'admin' | 'unit'
      if (targetUnits) s.targetUnits = targetUnits
    }
    persist(cfg); set({ config: cfg })
  },

  deleteSection: (id) => {
    pushHistory(get, set)
    const cfg = structuredClone(get().config)
    cfg.sections = cfg.sections.filter(s => s.id !== id)
    persist(cfg); set({ config: cfg })
  },

  toggleCollapse: (id) => {
    const cfg = structuredClone(get().config)
    const s = cfg.sections.find(s => s.id === id)
    if (!s) return
    if (s.collapsed) {
      s.collapsed = false
      s.layout = { ...s.layout, h: Math.max(s._expandedH ?? SECTION_DEFAULT_H, SECTION_MIN_H), minH: SECTION_MIN_H }
    } else {
      s._expandedH = s.layout.h
      s.collapsed = true
      s.layout = { ...s.layout, h: COLLAPSED_H, minH: COLLAPSED_H }
    }
    persist(cfg); set({ config: cfg })
  },

  updateSectionLayout: (id, layout) => {
    const cfg = structuredClone(get().config)
    const s = cfg.sections.find(s => s.id === id)
    if (s) s.layout = { ...s.layout, ...layout }
    persist(cfg); set({ config: cfg })
  },

  batchUpdateLayouts: (layouts) => {
    const cfg = structuredClone(get().config)
    layouts.forEach(({ id, layout }) => {
      const s = cfg.sections.find(s => s.id === id)
      if (s && !s.collapsed) { s.layout = { ...s.layout, ...layout }; s._expandedH = layout.h }
    })
    persist(cfg); set({ config: cfg })
  },

  resetLayout: () => {
    const cfg = structuredClone(get().config)
    cfg.sections = autoLayout(cfg.sections.map(s => ({
      ...s, collapsed: false, _expandedH: SECTION_DEFAULT_H,
      layout: { x: 0, y: 0, w: SECTION_DEFAULT_W, h: SECTION_DEFAULT_H },
    })))
    persist(cfg); set({ config: cfg })
  },

  // ── items ────────────────────────────────────────────────
  addItem: (sectionId, data) => {
    pushHistory(get, set)
    const cfg = structuredClone(get().config)
    const sec = cfg.sections.find(s => s.id === sectionId)
    if (sec) sec.items.push({ id: 'i' + uid(), ...data })
    persist(cfg); set({ config: cfg })
  },
  updateItem: (sectionId, itemId, data) => {
    pushHistory(get, set)
    const cfg = structuredClone(get().config)
    const sec = cfg.sections.find(s => s.id === sectionId)
    if (!sec) return
    const idx = sec.items.findIndex(i => i.id === itemId)
    if (idx >= 0) sec.items[idx] = { id: itemId, ...data }
    persist(cfg); set({ config: cfg })
  },
  deleteItem: (sectionId, itemId) => {
    pushHistory(get, set)
    const cfg = structuredClone(get().config)
    const sec = cfg.sections.find(s => s.id === sectionId)
    if (sec) sec.items = sec.items.filter(i => i.id !== itemId)
    persist(cfg); set({ config: cfg })
  },
  moveItem: (srcSectionId, itemId, tgtSectionId, tgtItemId) => {
    const cfg = structuredClone(get().config)
    const src = cfg.sections.find(s => s.id === srcSectionId)
    const tgt = cfg.sections.find(s => s.id === tgtSectionId)
    if (!src || !tgt) return
    const si = src.items.findIndex(i => i.id === itemId)
    if (si < 0) return
    const [item] = src.items.splice(si, 1)
    if (tgtItemId) {
      const ti = tgt.items.findIndex(i => i.id === tgtItemId)
      tgt.items.splice(ti >= 0 ? ti : tgt.items.length, 0, item)
    } else tgt.items.push(item)
    persist(cfg); set({ config: cfg })
  },

  // ── ui ───────────────────────────────────────────────────
  history: [],
  future:  [],
  canUndo: false,
  canRedo: false,

  undo: () => {
    const { history, config, future } = get()
    if (!history.length) return
    const prev = history[history.length - 1]
    const newHistory = history.slice(0, -1)
    const newFuture  = [structuredClone(config), ...future].slice(0, MAX_HISTORY)
    persist(prev)
    set({ config: prev, history: newHistory, future: newFuture, canUndo: newHistory.length > 0, canRedo: true })
  },

  redo: () => {
    const { future, config, history } = get()
    if (!future.length) return
    const next = future[0]
    const newFuture  = future.slice(1)
    const newHistory = [...history, structuredClone(config)].slice(-MAX_HISTORY)
    persist(next)
    set({ config: next, history: newHistory, future: newFuture, canUndo: true, canRedo: newFuture.length > 0 })
  },

  editMode: false,
  toggleEditMode: () => set(s => ({ editMode: !s.editMode })),
  searchQuery: '',
  setSearch: (q) => set({ searchQuery: q }),
  currentPage: 'beranda',
  setCurrentPage: (page) => set({ currentPage: page, searchQuery: '' }),
  previewUnit: null,
  setPreviewUnit: (unit) => set({ previewUnit: unit, editMode: false }),

  displayOptions: loadConfig().displayOptions,
  setDisplayOptions: (o) => {
    const next = { ...get().displayOptions, ...o }
    const cfg  = structuredClone(get().config)
    cfg.displayOptions = next
    persist(cfg); set({ displayOptions: next, config: cfg })
  },
  appearance: loadConfig().appearance,
  setAppearance: (o) => {
    const next: AppearanceSettings = { ...get().appearance, ...o }
    const cfg = structuredClone(get().config)
    cfg.appearance = next
    persist(cfg); set({ appearance: next, config: cfg })
  },

  // ── presets ──────────────────────────────────────────────
  presets: loadPresets(),
  savePreset: (name) => {
    const presets = [...get().presets, { id: uid(), name, ts: Date.now() }]
    savePresets(presets); set({ presets })
  },
  applyPreset: (_id) => {},
  deletePreset: (id) => {
    const presets = get().presets.filter(x => x.id !== id)
    savePresets(presets); set({ presets })
  },

  // ── toasts ───────────────────────────────────────────────
  toasts: [],
  toast: (msg, type = 'success') => {
    const id = uid()
    set(s => ({ toasts: [...s.toasts, { id, msg, type }] }))
    setTimeout(() => get().removeToast(id), 3000)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
