// ─────────────────────────────────────────────
// DASHBOARD STORE — split global + unit config
// ─────────────────────────────────────────────
import { create } from 'zustand'
import type {
  JateamConfig, Section, LinkItem, AppearanceSettings,
  DisplayOptions, Preset, ThemeId, PageDef,
} from '../types'
import {
  DEFAULT_APPEARANCE, defaultDisplayOptions, DEFAULT_PAGES,
  GRID_ROW_HEIGHT, SECTION_DEFAULT_W, SECTION_DEFAULT_H,
} from '../types'
import {
  loadGlobalConfig, saveGlobalConfig,
  loadUnitConfig, saveUnitConfig,
  saveUserAppearance, loadUserAppearance,
  saveGlobalTheme, loadGlobalTheme,
} from '../utils/supabaseClient'

const DATA_KEY       = 'jateamhub-data'
const APPEARANCE_KEY = 'jateamhub-appearance'
const CONFIG_VERSION = '4.0'
const MAX_HISTORY    = 20

// ── Local appearance ──────────────────────────
const loadLocalAppearance = (): Partial<AppearanceSettings> => {
  try { const a = localStorage.getItem(APPEARANCE_KEY); return a ? JSON.parse(a) : {} } catch { return {} }
}
const saveLocalAppearance = (a: AppearanceSettings) =>
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(a))

// ── Device preset ─────────────────────────────
const getDevicePreset = (): Partial<AppearanceSettings> => {
  const w = window.innerWidth
  if (w < 480) return { itemDisplayMode: 'folderGrid', iconSize: 'medium', folderGridCols: 2 }
  if (w < 768) return { itemDisplayMode: 'folderGrid', iconSize: 'large',  folderGridCols: 3 }
  return {}
}
const DEVICE_PREF_KEY = 'jateamhub-device-pref'
const hasDevicePref   = () => !!localStorage.getItem(DEVICE_PREF_KEY)
const setDevicePref   = () => localStorage.setItem(DEVICE_PREF_KEY, '1')

// ── uid ───────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10)

// ── Default config ────────────────────────────
const defaultConfig: JateamConfig = {
  version:        CONFIG_VERSION,
  meta: { title: 'JateamHub', subtitle: 'Selamat datang, {username}', logoUrl: '', coffeeUrl: '', adminKey: '' },
  pages:          [...DEFAULT_PAGES],
  sections:       [],
  appearance:     { ...DEFAULT_APPEARANCE },
  displayOptions: { ...defaultDisplayOptions },
  presets:        [],
}

// ── Persist ───────────────────────────────────
const persist = (cfg: JateamConfig) => {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(cfg)) } catch {}
}
const loadLocal = (): JateamConfig => {
  try {
    const d = localStorage.getItem(DATA_KEY)
    if (!d) return structuredClone(defaultConfig)
    const p = JSON.parse(d)
    if (String(p.version ?? '0').split('.')[0] !== CONFIG_VERSION.split('.')[0]) {
      return structuredClone(defaultConfig)
    }
    p.appearance     = { ...DEFAULT_APPEARANCE,    ...(p.appearance    ?? {}) }
    p.displayOptions = { ...defaultDisplayOptions, ...(p.displayOptions ?? {}) }
    p.pages          = Array.isArray(p.pages) && p.pages.length > 0 ? p.pages : [...DEFAULT_PAGES]
    return p
  } catch { return structuredClone(defaultConfig) }
}

// ── Auto layout ───────────────────────────────
const autoLayout = (sections: Section[]): Section[] => {
  const COLS = 12; let col = 0, row = 0, rowH = 0
  return sections.map(s => {
    const w = Math.min(s.layout?.w ?? SECTION_DEFAULT_W, COLS)
    const h = s.collapsed ? 1 : (s.layout?.h ?? SECTION_DEFAULT_H)
    if (col + w > COLS) { row += rowH; col = 0; rowH = 0 }
    const layout = { x: col, y: row, w, h }
    col += w; rowH = Math.max(rowH, h)
    return { ...s, layout }
  })
}

// ── Debounce sync ─────────────────────────────
let globalSyncTimer: ReturnType<typeof setTimeout> | null = null
let unitSyncTimers: Record<string, ReturnType<typeof setTimeout>> = {}

// ── Store interface ───────────────────────────
interface DashboardStore {
  config:         JateamConfig
  unitSections:   Record<string, Section[]>  // unit_id → sections
  appearance:     AppearanceSettings
  displayOptions: DisplayOptions
  presets:        Preset[]
  editMode:       boolean
  searchQuery:    string
  currentPage:    string
  previewUnit:    string | null
  currentUserId:  string | null
  globalTheme:    ThemeId
  history:        JateamConfig[]
  future:         JateamConfig[]
  canUndo:        boolean
  canRedo:        boolean
  isDirty:        boolean
  isSyncing:      boolean
  syncStatus:     'saved' | 'saving' | 'error' | 'idle'

  // Init
  loadRemoteConfig:  (userId: string, role: string, unitId: string) => Promise<void>
  setCurrentUserId:  (id: string | null) => void

  // Config
  setConfig:     (cfg: JateamConfig) => void
  resetConfig:   () => void
  resetLayout:   () => void

  // Section — global
  addSection:          (...args: any[]) => void
  updateSection:       (id: string, title: string, icon: string, subtitle: string, w: number, accent?: string, pageId?: string, visibility?: string, targetUnits?: string[]) => void
  deleteSection:       (id: string) => void
  toggleCollapse:      (id: string) => void
  batchUpdateLayouts:  (layouts: Array<{ id: string; layout: any }>) => void
  updateSectionLayout: (id: string, layout: any) => void

  // Section — unit
  addUnitSection:     (unitId: string, data: Partial<Section>) => void
  updateUnitSection:  (unitId: string, sectionId: string, updates: Partial<Section>) => void
  deleteUnitSection:  (unitId: string, sectionId: string) => void
  batchUpdateUnitLayouts: (unitId: string, layouts: Array<{ id: string; layout: any }>) => void

  // Items
  addItem:     (sectionId: string, data: Omit<LinkItem, 'id'>, unitId?: string) => void
  updateItem:  (sectionId: string, itemId: string, data: Omit<LinkItem, 'id'>, unitId?: string) => void
  deleteItem:  (sectionId: string, itemId: string, unitId?: string) => void
  moveItem:    (srcId: string, itemId: string, tgtId: string, tgtItemId?: string) => void

  // UI
  toggleEditMode:    () => void
  setSearch:         (q: string) => void
  setCurrentPage:    (p: string) => void
  setPreviewUnit:    (u: string | null) => void

  // Appearance
  setAppearance:     (o: Partial<AppearanceSettings>) => void
  setDisplayOptions: (o: Partial<DisplayOptions>) => void
  setGlobalTheme:    (theme: ThemeId) => void

  // Presets
  savePreset:   (name: string) => void
  applyPreset:  (id: string) => void
  deletePreset: (id: string) => void

  // Undo/Redo
  undo: () => void
  redo: () => void

  // Sync
  syncGlobalToDb:   () => Promise<void>
  syncUnitToDb:     (unitId: string) => Promise<void>

  // Toast
  toast: (msg: string, type?: 'success' | 'error' | 'warn') => void
  toasts: Array<{ id: string; msg: string; type: 'success' | 'error' | 'warn' }>
  removeToast: (id: string) => void
}

export const useStore = create<DashboardStore>((set, get) => ({
  config:         loadLocal(),
  unitSections:   {},
  appearance:     { ...DEFAULT_APPEARANCE, ...loadLocalAppearance() },
  displayOptions: { ...defaultDisplayOptions },
  presets:        [],
  editMode:       false,
  searchQuery:    '',
  currentPage:    'beranda',
  previewUnit:    null,
  currentUserId:  null,
  globalTheme:    'dark-mint',
  history:        [],
  future:         [],
  canUndo:        false,
  canRedo:        false,
  isDirty:        false,
  isSyncing:      false,
  syncStatus:     'idle',
  toasts:         [],

  // ── Toast ─────────────────────────────────
  toast: (msg, type = 'success') => {
    const id = uid()
    set(s => ({ toasts: [...s.toasts.slice(-2), { id, msg, type }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  setCurrentUserId: (id) => set({ currentUserId: id }),

  // ── Load remote config ────────────────────
  loadRemoteConfig: async (userId, role, unitId) => {
    try {
      // Load global config
      const remote = await loadGlobalConfig()
      if (remote && Array.isArray((remote as any).sections)) {
        const cfg = remote as unknown as JateamConfig
        cfg.appearance     = { ...DEFAULT_APPEARANCE, ...(cfg.appearance ?? {}) }
        cfg.sections       = autoLayout(cfg.sections || [])
        cfg.displayOptions = { ...defaultDisplayOptions, ...(cfg.displayOptions ?? {}) }
        cfg.pages          = Array.isArray(cfg.pages) && cfg.pages.length ? cfg.pages : [...DEFAULT_PAGES]
        cfg.presets        = Array.isArray(cfg.presets) ? cfg.presets : []

        // Load appearance per user
        const userAppearance = await loadUserAppearance(userId)
        if (userAppearance && Object.keys(userAppearance).length > 0) {
          cfg.appearance = { ...DEFAULT_APPEARANCE, ...cfg.appearance, ...userAppearance }
        } else if (!hasDevicePref()) {
          const preset = getDevicePreset()
          if (Object.keys(preset).length > 0) {
            cfg.appearance = { ...cfg.appearance, ...preset }
            setDevicePref()
          }
        }
        saveLocalAppearance(cfg.appearance)
        persist(cfg)
        set({ config: cfg, appearance: cfg.appearance, displayOptions: cfg.displayOptions, presets: cfg.presets })
      }

      // Load unit config jika user punya unit
      if (unitId && unitId !== '') {
        const unitCfg = await loadUnitConfig(unitId)
        if (unitCfg) {
          const sections = autoLayout(((unitCfg as any).sections ?? []) as Section[])
          set(s => ({ unitSections: { ...s.unitSections, [unitId]: sections } }))
        }
      }

      // Load global theme
      const theme = await loadGlobalTheme()
      set({ globalTheme: theme })
      applyThemeToDOM(theme)

    } catch (e) {
      console.error('[JateamHub] loadRemoteConfig failed:', e)
    }
  },

  // ── Sync global ───────────────────────────
  syncGlobalToDb: async () => {
    if (globalSyncTimer) clearTimeout(globalSyncTimer)
    set({ isDirty: true, syncStatus: 'saving' })
    globalSyncTimer = setTimeout(async () => {
      const cfg = get().config
      set({ isSyncing: true })
      try {
        const result = await saveGlobalConfig(cfg as unknown as Record<string, unknown>)
        if ((result as any)?.error) {
          set({ isSyncing: false, syncStatus: 'error', isDirty: true })
        } else {
          set({ isSyncing: false, syncStatus: 'saved', isDirty: false })
          setTimeout(() => set({ syncStatus: 'idle' }), 3000)
        }
      } catch {
        set({ isSyncing: false, syncStatus: 'error', isDirty: true })
      }
    }, 1500)
  },

  // ── Sync unit ─────────────────────────────
  syncUnitToDb: async (unitId) => {
    if (unitSyncTimers[unitId]) clearTimeout(unitSyncTimers[unitId])
    set({ isDirty: true, syncStatus: 'saving' })
    unitSyncTimers[unitId] = setTimeout(async () => {
      const sections = get().unitSections[unitId] ?? []
      set({ isSyncing: true })
      try {
        const result = await saveUnitConfig(unitId, { sections } as unknown as Record<string, unknown>)
        if ((result as any)?.error) {
          set({ isSyncing: false, syncStatus: 'error', isDirty: true })
        } else {
          set({ isSyncing: false, syncStatus: 'saved', isDirty: false })
          setTimeout(() => set({ syncStatus: 'idle' }), 3000)
        }
      } catch {
        set({ isSyncing: false, syncStatus: 'error', isDirty: true })
      }
    }, 1500)
  },

  // ── History ───────────────────────────────
  setConfig: (cfg) => {
    const prev = get().config
    const history = [...get().history, structuredClone(prev)].slice(-MAX_HISTORY)
    persist(cfg)
    get().syncGlobalToDb()
    set({ config: cfg, history, future: [], canUndo: true, canRedo: false, appearance: cfg.appearance, displayOptions: cfg.displayOptions })
  },

  resetConfig: () => {
    const fresh = structuredClone(defaultConfig)
    persist(fresh)
    get().syncGlobalToDb()
    set({ config: fresh, appearance: fresh.appearance, displayOptions: fresh.displayOptions, currentPage: 'beranda', previewUnit: null, history: [], future: [], canUndo: false, canRedo: false })
  },

  resetLayout: () => {
    const cfg = structuredClone(get().config)
    cfg.sections = autoLayout(cfg.sections)
    persist(cfg)
    get().syncGlobalToDb()
    set({ config: cfg })
  },

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
    const { history, config, future } = get()
    if (!future.length) return
    const next = future[0]
    const newFuture  = future.slice(1)
    const newHistory = [...history, structuredClone(config)].slice(-MAX_HISTORY)
    persist(next)
    set({ config: next, history: newHistory, future: newFuture, canUndo: true, canRedo: newFuture.length > 0 })
  },

  toggleEditMode: () => set(s => ({ editMode: !s.editMode, searchQuery: '' })),
  setSearch:      (q) => set({ searchQuery: q }),
  setCurrentPage: (p) => set({ currentPage: p, searchQuery: '' }),
  setPreviewUnit: (u) => set({ previewUnit: u, editMode: false }),

  // ── Global sections ───────────────────────
  addSection: (title, icon, subtitle, accent, visibility, targetUnits, pageId, type, widgetType) => {
    const cfg = structuredClone(get().config)
    const COLS = 12
    const existing = cfg.sections.filter(s => (s.pageId ?? 'beranda') === (pageId ?? 'beranda'))
    const maxY = existing.reduce((m, s) => Math.max(m, s.layout.y + s.layout.h), 0)
    cfg.sections.push({
      id: 's' + uid(), title, icon, subtitle, items: [],
      layout: { x: 0, y: maxY, w: SECTION_DEFAULT_W, h: SECTION_DEFAULT_H },
      visibility: visibility ?? 'all', targetUnits: targetUnits ?? [],
      pageId: pageId ?? 'beranda', accentColor: accent, type: type ?? 'section', widgetType,
    })
    const prev = get().config
    const history = [...get().history, structuredClone(prev)].slice(-MAX_HISTORY)
    persist(cfg)
    get().syncGlobalToDb()
    set({ config: cfg, history, future: [], canUndo: true, canRedo: false })
  },

  updateSection: (id, title, icon, subtitle, w, accent, pageId, visibility, targetUnits) => {
    const cfg = structuredClone(get().config)
    const s = cfg.sections.find(s => s.id === id)
    if (s) {
      s.title = title; s.icon = icon; s.subtitle = subtitle
      s.layout.w = Math.floor(w / 70) || s.layout.w
      if (accent !== undefined) s.accentColor = accent
      if (pageId) s.pageId = pageId
      if (visibility) s.visibility = visibility as any
      if (targetUnits) s.targetUnits = targetUnits
    }
    persist(cfg); get().syncGlobalToDb()
    set({ config: cfg })
  },

  deleteSection: (id) => {
    const cfg = structuredClone(get().config)
    cfg.sections = cfg.sections.filter(s => s.id !== id)
    const prev = get().config
    const history = [...get().history, structuredClone(prev)].slice(-MAX_HISTORY)
    persist(cfg); get().syncGlobalToDb()
    set({ config: cfg, history, future: [], canUndo: true, canRedo: false })
  },

  toggleCollapse: (id) => {
    const cfg = structuredClone(get().config)
    const s = cfg.sections.find(s => s.id === id)
    if (s) {
      if (!s.collapsed) { s._expandedH = s.layout.h; s.layout.h = 1; s.collapsed = true }
      else { s.layout.h = s._expandedH ?? SECTION_DEFAULT_H; s.collapsed = false }
    }
    persist(cfg); get().syncGlobalToDb()
    set({ config: cfg })
  },

  batchUpdateLayouts: (layouts) => {
    const cfg = structuredClone(get().config)
    layouts.forEach(({ id, layout }) => {
      const s = cfg.sections.find(s => s.id === id)
      if (s && !s.collapsed) { s.layout = { ...s.layout, ...layout }; s._expandedH = layout.h }
    })
    persist(cfg)
    if (globalSyncTimer) clearTimeout(globalSyncTimer)
    set({ config: cfg, isDirty: true, syncStatus: 'saving' })
    globalSyncTimer = setTimeout(async () => {
      set({ isSyncing: true })
      try {
        const result = await saveGlobalConfig(cfg as unknown as Record<string, unknown>)
        if ((result as any)?.error) set({ isSyncing: false, syncStatus: 'error', isDirty: true })
        else { set({ isSyncing: false, syncStatus: 'saved', isDirty: false }); setTimeout(() => set({ syncStatus: 'idle' }), 3000) }
      } catch { set({ isSyncing: false, syncStatus: 'error', isDirty: true }) }
    }, 3000)
  },

  updateSectionLayout: (id, layout) => {
    const cfg = structuredClone(get().config)
    const s = cfg.sections.find(s => s.id === id)
    if (s) s.layout = { ...s.layout, ...layout }
    persist(cfg); get().syncGlobalToDb()
    set({ config: cfg })
  },

  // ── Unit sections ─────────────────────────
  addUnitSection: (unitId, data) => {
    const current = structuredClone(get().unitSections[unitId] ?? [])
    const maxY = current.reduce((m, s) => Math.max(m, s.layout.y + s.layout.h), 0)
    current.push({
      id: 's' + uid(), title: data.title ?? 'New Section',
      icon: data.icon ?? '📁', subtitle: data.subtitle ?? '', items: [],
      layout: { x: 0, y: maxY, w: SECTION_DEFAULT_W, h: SECTION_DEFAULT_H },
      visibility: 'unit', targetUnits: [unitId],
      pageId: 'beranda', accentColor: data.accentColor, type: 'section',
    })
    set(s => ({ unitSections: { ...s.unitSections, [unitId]: current } }))
    get().syncUnitToDb(unitId)
  },

  updateUnitSection: (unitId, sectionId, updates) => {
    const current = structuredClone(get().unitSections[unitId] ?? [])
    const idx = current.findIndex(s => s.id === sectionId)
    if (idx >= 0) current[idx] = { ...current[idx], ...updates }
    set(s => ({ unitSections: { ...s.unitSections, [unitId]: current } }))
    get().syncUnitToDb(unitId)
  },

  deleteUnitSection: (unitId, sectionId) => {
    const current = (get().unitSections[unitId] ?? []).filter(s => s.id !== sectionId)
    set(s => ({ unitSections: { ...s.unitSections, [unitId]: current } }))
    get().syncUnitToDb(unitId)
  },

  batchUpdateUnitLayouts: (unitId, layouts) => {
    const current = structuredClone(get().unitSections[unitId] ?? [])
    layouts.forEach(({ id, layout }) => {
      const s = current.find(s => s.id === id)
      if (s) { s.layout = { ...s.layout, ...layout }; s._expandedH = layout.h }
    })
    set(s => ({ unitSections: { ...s.unitSections, [unitId]: current } }))
    if (unitSyncTimers[unitId]) clearTimeout(unitSyncTimers[unitId])
    unitSyncTimers[unitId] = setTimeout(async () => {
      await saveUnitConfig(unitId, { sections: current } as unknown as Record<string, unknown>)
    }, 3000)
  },

  // ── Items ─────────────────────────────────
  addItem: (sectionId, data, unitId) => {
    if (unitId) {
      const current = structuredClone(get().unitSections[unitId] ?? [])
      const s = current.find(s => s.id === sectionId)
      if (s) s.items.push({ id: 'i' + uid(), ...data })
      set(st => ({ unitSections: { ...st.unitSections, [unitId]: current } }))
      get().syncUnitToDb(unitId)
    } else {
      const cfg = structuredClone(get().config)
      const s = cfg.sections.find(s => s.id === sectionId)
      if (s) s.items.push({ id: 'i' + uid(), ...data })
      persist(cfg); get().syncGlobalToDb(); set({ config: cfg })
    }
  },

  updateItem: (sectionId, itemId, data, unitId) => {
    if (unitId) {
      const current = structuredClone(get().unitSections[unitId] ?? [])
      const s = current.find(s => s.id === sectionId)
      if (s) { const idx = s.items.findIndex(i => i.id === itemId); if (idx >= 0) s.items[idx] = { id: itemId, ...data } }
      set(st => ({ unitSections: { ...st.unitSections, [unitId]: current } }))
      get().syncUnitToDb(unitId)
    } else {
      const cfg = structuredClone(get().config)
      const s = cfg.sections.find(s => s.id === sectionId)
      if (s) { const idx = s.items.findIndex(i => i.id === itemId); if (idx >= 0) s.items[idx] = { id: itemId, ...data } }
      persist(cfg); get().syncGlobalToDb(); set({ config: cfg })
    }
  },

  deleteItem: (sectionId, itemId, unitId) => {
    if (unitId) {
      const current = structuredClone(get().unitSections[unitId] ?? [])
      const s = current.find(s => s.id === sectionId)
      if (s) s.items = s.items.filter(i => i.id !== itemId)
      set(st => ({ unitSections: { ...st.unitSections, [unitId]: current } }))
      get().syncUnitToDb(unitId)
    } else {
      const cfg = structuredClone(get().config)
      const s = cfg.sections.find(s => s.id === sectionId)
      if (s) s.items = s.items.filter(i => i.id !== itemId)
      persist(cfg); get().syncGlobalToDb(); set({ config: cfg })
    }
  },

  moveItem: (srcId, itemId, tgtId, tgtItemId) => {
    const cfg = structuredClone(get().config)
    const src = cfg.sections.find(s => s.id === srcId)
    const tgt = cfg.sections.find(s => s.id === tgtId)
    if (!src || !tgt) return
    const item = src.items.find(i => i.id === itemId)
    if (!item) return
    src.items = src.items.filter(i => i.id !== itemId)
    if (tgtItemId) {
      const tgtIdx = tgt.items.findIndex(i => i.id === tgtItemId)
      tgt.items.splice(tgtIdx >= 0 ? tgtIdx : tgt.items.length, 0, item)
    } else tgt.items.push(item)
    persist(cfg); get().syncGlobalToDb(); set({ config: cfg })
  },

  // ── Appearance ────────────────────────────
  setAppearance: (o) => {
    const next = { ...get().appearance, ...o }
    const cfg  = structuredClone(get().config)
    cfg.appearance = next
    saveLocalAppearance(next)
    persist(cfg)
    const userId = get().currentUserId
    if (userId) saveUserAppearance(userId, next)
    set({ appearance: next, config: cfg })
  },

  setDisplayOptions: (o) => {
    const next = { ...get().displayOptions, ...o }
    const cfg  = structuredClone(get().config)
    cfg.displayOptions = next
    persist(cfg)
    set({ displayOptions: next, config: cfg })
  },

  setGlobalTheme: (theme) => {
    saveGlobalTheme(theme)
    applyThemeToDOM(theme)
    set({ globalTheme: theme })
    get().setAppearance({ theme })
  },

  // ── Presets ───────────────────────────────
  savePreset: (name) => {
    const preset: Preset = { id: uid(), name, appearance: { ...get().appearance } }
    const cfg = structuredClone(get().config)
    cfg.presets = [...(cfg.presets ?? []), preset]
    persist(cfg); get().syncGlobalToDb()
    set({ config: cfg, presets: cfg.presets })
  },
  applyPreset: (id) => {
    const preset = get().presets.find(p => p.id === id)
    if (!preset) return
    get().setAppearance(preset.appearance)
  },
  deletePreset: (id) => {
    const cfg = structuredClone(get().config)
    cfg.presets = (cfg.presets ?? []).filter(p => p.id !== id)
    persist(cfg); get().syncGlobalToDb()
    set({ config: cfg, presets: cfg.presets })
  },
}))

// ── Theme DOM ─────────────────────────────────
export function applyThemeToDOM(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme)
}
