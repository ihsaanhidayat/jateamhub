// ─────────────────────────────────────────────────────────────
// DASHBOARD STORE — State management layout dan tampilan dashboard
// Pisahan antara: section pribadi user + shared sections dari admin
// ─────────────────────────────────────────────────────────────
import { create } from 'zustand'
import type {
  JateamConfig, Section, LinkItem,
  AppearanceSettings, DisplayOptions, Preset, ThemeId, PageDef,
} from '../types'
import {
  DEFAULT_APPEARANCE, defaultDisplayOptions, DEFAULT_PAGES,
  SECTION_DEFAULT_W, SECTION_DEFAULT_H, GRID_ROW_HEIGHT,
} from '../types'
import {
  getUserLayout, saveUserLayout,
  getSharedSections, getAllSharedSections,
  createSharedSection, updateSharedSection, deleteSharedSection,
  saveUserAppearance, loadUserAppearance,
  saveGlobalTheme, loadGlobalTheme,
} from '../utils/supabaseClient'
import type { SharedSection } from '../utils/supabaseClient'

// ── Konstanta ─────────────────────────────────────────────────
const CONFIG_VERSION  = '5.0'   // versi format config
const MAX_HISTORY     = 20      // maksimal langkah undo
const DATA_KEY        = 'jateamhub-personal' // key localStorage section pribadi
const APPEARANCE_KEY  = 'jateamhub-appearance' // key localStorage preferensi tampilan

// ── Helper: simpan/baca preferensi tampilan dari localStorage ──
const loadLocalAppearance = (): Partial<AppearanceSettings> => {
  try {
    const a = localStorage.getItem(APPEARANCE_KEY)
    return a ? JSON.parse(a) : {}
  } catch { return {} }
}
const saveLocalAppearance = (a: AppearanceSettings) =>
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(a))

// ── Helper: preset tampilan berdasarkan ukuran layar device ───
const getDevicePreset = (): Partial<AppearanceSettings> => {
  const w = window.innerWidth
  if (w < 480) return { itemDisplayMode: 'folderGrid', iconSize: 'medium', folderGridCols: 2 }
  if (w < 768) return { itemDisplayMode: 'folderGrid', iconSize: 'large',  folderGridCols: 3 }
  return {} // desktop — pakai preferensi tersimpan
}
const DEVICE_PREF_KEY = 'jateamhub-device-pref'
const hasDevicePref   = () => !!localStorage.getItem(DEVICE_PREF_KEY)
const setDevicePref   = () => localStorage.setItem(DEVICE_PREF_KEY, '1')

// ── Helper: generate ID unik untuk section/item ───────────────
const uid = () => Math.random().toString(36).slice(2, 10)

// ── Helper: auto-layout section agar tidak tumpang tindih ─────
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

// ── Helper: baca section pribadi dari localStorage ────────────
const loadPersonalFromLocal = (): Section[] => {
  try {
    const d = localStorage.getItem(DATA_KEY)
    return d ? JSON.parse(d) : []
  } catch { return [] }
}

// ── Helper: simpan section pribadi ke localStorage ────────────
const persistPersonal = (sections: Section[]) => {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(sections)) } catch {}
}

// ── Debounce timer untuk sync ke DB ──────────────────────────
let personalSyncTimer:  ReturnType<typeof setTimeout> | null = null
let appearanceSyncTimer: ReturnType<typeof setTimeout> | null = null

// ── Tipe interface store ──────────────────────────────────────
interface DashboardStore {
  // -- State --
  personalSections: Section[]        // section pribadi user
  sharedSections:   SharedSection[]  // section dari admin (read-only)
  appearance:       AppearanceSettings
  displayOptions:   DisplayOptions
  presets:          Preset[]
  editMode:         boolean
  searchQuery:      string
  previewFilter:    { role: string; region: string; unit: string } // filter preview admin
  currentUserId:    string | null
  currentUserRole:  string
  currentRegion:    string
  currentUnit:      string
  globalTheme:      ThemeId
  history:          Section[][]   // stack undo
  future:           Section[][]   // stack redo
  canUndo:          boolean
  canRedo:          boolean
  isDirty:          boolean
  isSyncing:        boolean
  syncStatus:       'saved' | 'saving' | 'error' | 'idle'

  // -- Init & Load --
  initUser:    (userId: string, role: string, region: string, unit: string) => Promise<void>
  setCurrentUserId: (id: string | null) => void

  // -- Section Pribadi --
  addPersonalSectionAuto: () => void
  addPersonalSection:    (data: Partial<Section>) => void
  updatePersonalSection: (id: string, updates: Partial<Section>) => void
  deletePersonalSection: (id: string) => void
  toggleCollapse:        (id: string) => void
  batchUpdateLayouts:    (layouts: Array<{ id: string; layout: any }>) => void

  // -- Items (dalam section pribadi) --
  addItem:    (sectionId: string, data: Omit<LinkItem, 'id'>) => void
  updateItem: (sectionId: string, itemId: string, data: Omit<LinkItem, 'id'>) => void
  deleteItem: (sectionId: string, itemId: string) => void
  moveItem:   (srcId: string, itemId: string, tgtId: string) => void

  // -- Shared Sections (admin only) --
  loadSharedSections:    () => Promise<void>
  addSharedSection:      (data: Omit<SharedSection, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateSharedSectionFn: (id: string, updates: Partial<SharedSection>) => Promise<void>
  deleteSharedSectionFn: (id: string) => Promise<void>

  // -- Favorites --
  toggleFavoriteSection: (id: string) => void
  toggleFavoriteItem:    (sectionId: string, itemId: string) => void

  // -- UI State --
  toggleEditMode:    () => void
  setSearch:         (q: string) => void
  setPreviewFilter:  (filter: { role: string; region: string; unit: string }) => void

  // -- Tampilan / Appearance --
  setAppearance:     (o: Partial<AppearanceSettings>) => void
  setDisplayOptions: (o: Partial<DisplayOptions>) => void
  setGlobalTheme:    (theme: ThemeId) => void

  // -- Presets --
  savePreset:   (name: string) => void
  applyPreset:  (id: string) => void
  deletePreset: (id: string) => void

  // -- Undo/Redo --
  undo: () => void
  redo: () => void

  // -- Sync --
  syncPersonalToDb: () => Promise<void>

  // -- Toast --
  toast:       (msg: string, type?: 'success' | 'error' | 'warn') => void
  toasts:      Array<{ id: string; msg: string; type: 'success' | 'error' | 'warn' }>
  removeToast: (id: string) => void
}

// ── Buat store dengan Zustand ─────────────────────────────────
export const useStore = create<DashboardStore>((set, get) => ({
  // -- Nilai awal state --
  personalSections: loadPersonalFromLocal(),
  sharedSections:   [],
  appearance:       { ...DEFAULT_APPEARANCE, ...loadLocalAppearance() },
  displayOptions:   { ...defaultDisplayOptions },
  presets:          [],
  editMode:         false,
  searchQuery:      '',
  previewFilter:    { role: '', region: '', unit: '' },
  currentUserId:    null,
  currentUserRole:  'user',
  currentRegion:    'global',
  currentUnit:      'general',
  globalTheme:      'pearl-light' as any,
  history:          [],
  future:           [],
  canUndo:          false,
  canRedo:          false,
  isDirty:          false,
  isSyncing:        false,
  syncStatus:       'idle',
  toasts:           [],

  // ── Toast: tampilkan notifikasi ───────────────────────────
  toast: (msg, type = 'success') => {
    const id = uid()
    set(s => ({ toasts: [...s.toasts.slice(-2), { id, msg, type }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  // ── Set ID user yang sedang login ─────────────────────────
  setCurrentUserId: (id) => set({ currentUserId: id }),

  // ── Init: load semua data saat user login ─────────────────
  initUser: async (userId, role, region, unit) => {
    set({ currentUserId: userId, currentUserRole: role, currentRegion: region, currentUnit: unit })

    // Load section pribadi dari DB
    const dbSections = await getUserLayout(userId)
    if (dbSections && Array.isArray(dbSections) && dbSections.length > 0) {
      // User sudah punya layout — reset posisi dari atas (y:0) agar tidak melayang
      const raw = dbSections as Section[]
      // Sort by posisi lama lalu re-layout dari atas
      const sorted = [...raw].sort((a, b) => (a.layout.y * 100 + a.layout.x) - (b.layout.y * 100 + b.layout.x))
      const sections = autoLayout(sorted)
      persistPersonal(sections)
      set({ personalSections: sections })
      // Simpan posisi baru ke DB
      await saveUserLayout(userId, sections)
    } else {
      // User pertama kali login — buat 2 section default: Layanan Bersama + Favorit
      const genId = () => 's' + Math.random().toString(36).slice(2, 10)
      const defaultSections: Section[] = [
        {
          id: genId(), title: 'LAYANAN BERSAMA', icon: '🌐',
          subtitle: 'Layanan internal perusahaan', items: [],
          layout: { x: 0, y: 0, w: 4, h: 5 },
          visibility: 'all', targetUnits: [], pageId: 'beranda', type: 'section',
        },
        {
          id: genId(), title: 'FAVORIT', icon: '⭐',
          subtitle: 'Section pribadiku', items: [],
          layout: { x: 4, y: 0, w: 4, h: 5 },
          visibility: 'all', targetUnits: [], pageId: 'beranda', type: 'section',
          isFavorite: false,
        },
      ]
      persistPersonal(defaultSections)
      set({ personalSections: defaultSections })
      await saveUserLayout(userId, defaultSections)
    }

    // Load shared sections sesuai role/region/unit user
    const shared = await getSharedSections(role, region, unit)
    set({ sharedSections: shared })

    // Load preferensi tampilan dari DB profil user
    const dbAppearance = await loadUserAppearance(userId)
    if (dbAppearance && Object.keys(dbAppearance).length > 0) {
      // DB lebih prioritas dari localStorage
      saveLocalAppearance(dbAppearance)
      set({ appearance: dbAppearance })
    } else if (!hasDevicePref()) {
      // Pertama kali di device ini — pakai preset berdasarkan ukuran layar
      const preset = getDevicePreset()
      if (Object.keys(preset).length > 0) {
        const next = { ...get().appearance, ...preset }
        saveLocalAppearance(next)
        set({ appearance: next })
        setDevicePref()
      }
    }

    // Load presets tampilan
    const localPresets = localStorage.getItem('jateamhub-presets')
    if (localPresets) set({ presets: JSON.parse(localPresets) })

    // Terapkan tema user dari appearance (bukan global)
    // Jika user belum punya tema, pakai pearl-light (default)
    const userAppearanceForTheme = await loadUserAppearance(userId)
    if (userAppearanceForTheme?.theme) {
      applyThemeToDOM(userAppearanceForTheme.theme as string)
    } else {
      applyThemeToDOM('aurora-light')
    }
  },

  // ── Load shared sections — bisa dipanggil ulang saat preview ─
  loadSharedSections: async () => {
    const { currentUserRole, currentRegion, currentUnit } = get()
    // Admin: load semua shared sections untuk dikelola
    if (currentUserRole === 'admin') {
      const all = await getAllSharedSections()
      set({ sharedSections: all })
    } else {
      // User biasa: load hanya yang sesuai scope-nya
      const filtered = await getSharedSections(currentUserRole, currentRegion, currentUnit)
      set({ sharedSections: filtered })
    }
  },

  // ── Sync section pribadi ke DB dengan debounce ────────────
  syncPersonalToDb: async () => {
    if (personalSyncTimer) clearTimeout(personalSyncTimer)
    set({ isDirty: true, syncStatus: 'saving' })
    personalSyncTimer = setTimeout(async () => {
      const { personalSections, currentUserId } = get()
      if (!currentUserId) return
      set({ isSyncing: true })
      try {
        const result = await saveUserLayout(currentUserId, personalSections)
        if ((result as any)?.error) {
          set({ isSyncing: false, syncStatus: 'error', isDirty: true })
        } else {
          set({ isSyncing: false, syncStatus: 'saved', isDirty: false })
          setTimeout(() => set({ syncStatus: 'idle' }), 3000)
        }
      } catch {
        set({ isSyncing: false, syncStatus: 'error', isDirty: true })
      }
    }, 1500) // tunggu 1.5 detik setelah perubahan terakhir
  },

  // ── Helper: push snapshot ke history untuk undo ───────────
  pushHistory: () => {
    const prev = get().personalSections
    const history = [...get().history, structuredClone(prev)].slice(-MAX_HISTORY)
    set({ history, future: [], canUndo: true, canRedo: false })
  },

  // ── Tambah section langsung tanpa modal (poin 5) ─────────
  addPersonalSectionAuto: () => {
    const current = get().personalSections
    const maxY    = current.reduce((m, s) => Math.max(m, s.layout.y + s.layout.h), 0)
    const lastRow = current.filter(s => s.layout.y + s.layout.h >= maxY)
    const maxX    = lastRow.reduce((m, s) => Math.max(m, s.layout.x + s.layout.w), 0)
    const sameRow = maxX + 4 <= 12
    const newSection: Section = {
      id: 's' + uid(), title: 'Section Baru', icon: '📁', subtitle: '',
      items: [],
      layout: { x: sameRow ? maxX : 0, y: sameRow ? Math.max(0, maxY - 5) : maxY, w: 4, h: 5 },
      visibility: 'all', targetUnits: [], pageId: 'beranda', type: 'section',
    }
    const next = [...current, newSection]
    persistPersonal(next); set({ personalSections: next }); get().syncPersonalToDb()
  },

  // ── Tambah section pribadi baru ───────────────────────────
  addPersonalSection: (data) => {
    ;(get() as any).pushHistory()
    const current = get().personalSections
    // Hitung posisi Y setelah section terakhir
    const maxY = current.reduce((m, s) => Math.max(m, s.layout.y + s.layout.h), 0)
    const newSection: Section = {
      id:          's' + uid(),
      title:       data.title       ?? 'Section Baru',
      icon:        data.icon        ?? '📁',
      subtitle:    data.subtitle    ?? '',
      items:       [],
      layout:      { x: 0, y: maxY, w: data.layout?.w ?? SECTION_DEFAULT_W, h: data.layout?.h ?? SECTION_DEFAULT_H },
      visibility:  'all',   // section pribadi selalu 'all' (hanya milik user ini)
      targetUnits: [],
      pageId:      'beranda',
      accentColor: data.accentColor,
      type:        data.type        ?? 'section',
      widgetType:  data.widgetType,
    }
    const next = [...current, newSection]
    persistPersonal(next)
    set({ personalSections: next })
    get().syncPersonalToDb()
  },

  // ── Update section pribadi ────────────────────────────────
  updatePersonalSection: (id, updates) => {
    const next = get().personalSections.map(s =>
      s.id === id ? { ...s, ...updates } : s
    )
    persistPersonal(next)
    set({ personalSections: next })
    get().syncPersonalToDb()
  },

  // ── Hapus section pribadi ─────────────────────────────────
  deletePersonalSection: (id) => {
    ;(get() as any).pushHistory()
    const next = get().personalSections.filter(s => s.id !== id)
    persistPersonal(next)
    set({ personalSections: next })
    get().syncPersonalToDb()
  },

  // ── Toggle collapse section (buka/tutup) ──────────────────
  toggleCollapse: (id) => {
    const next = get().personalSections.map(s => {
      if (s.id !== id) return s
      if (!s.collapsed) {
        // Simpan tinggi asli, set tinggi jadi 1 (hanya header)
        return { ...s, _expandedH: s.layout.h, layout: { ...s.layout, h: 1 }, collapsed: true }
      } else {
        // Kembalikan ke tinggi asli
        return { ...s, layout: { ...s.layout, h: s._expandedH ?? SECTION_DEFAULT_H }, collapsed: false }
      }
    })
    persistPersonal(next)
    set({ personalSections: next })
    get().syncPersonalToDb()
  },

  // ── Update posisi/ukuran banyak section sekaligus (setelah drag) ──
  batchUpdateLayouts: (layouts) => {
    const next = get().personalSections.map(s => {
      const found = layouts.find(l => l.id === s.id)
      if (!found || s.collapsed) return s
      return { ...s, layout: { ...s.layout, ...found.layout }, _expandedH: found.layout.h }
    })
    persistPersonal(next)
    set({ personalSections: next, isDirty: true, syncStatus: 'saving' })
    // Debounce lebih panjang (3 detik) untuk drag — banyak update kecil
    if (personalSyncTimer) clearTimeout(personalSyncTimer)
    personalSyncTimer = setTimeout(async () => {
      const { currentUserId } = get()
      if (!currentUserId) return
      set({ isSyncing: true })
      try {
        await saveUserLayout(currentUserId, next)
        set({ isSyncing: false, syncStatus: 'saved', isDirty: false })
        setTimeout(() => set({ syncStatus: 'idle' }), 3000)
      } catch {
        set({ isSyncing: false, syncStatus: 'error', isDirty: true })
      }
    }, 3000)
  },

  // ── Tambah item/link ke dalam section pribadi ─────────────
  addItem: (sectionId, data) => {
    const next = get().personalSections.map(s =>
      s.id === sectionId
        ? { ...s, items: [...s.items, { id: 'i' + uid(), ...data }] }
        : s
    )
    persistPersonal(next)
    set({ personalSections: next })
    get().syncPersonalToDb()
  },

  // ── Update item/link di dalam section pribadi ─────────────
  updateItem: (sectionId, itemId, data) => {
    const next = get().personalSections.map(s => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        items: s.items.map(i => i.id === itemId ? { id: itemId, ...data } : i)
      }
    })
    persistPersonal(next)
    set({ personalSections: next })
    get().syncPersonalToDb()
  },

  // ── Hapus item/link dari section pribadi ──────────────────
  deleteItem: (sectionId, itemId) => {
    const next = get().personalSections.map(s => {
      if (s.id !== sectionId) return s
      return { ...s, items: s.items.filter(i => i.id !== itemId) }
    })
    persistPersonal(next)
    set({ personalSections: next })
    get().syncPersonalToDb()
  },

  // ── Pindahkan item antar section ──────────────────────────
  moveItem: (srcId, itemId, tgtId) => {
    const sections = get().personalSections
    const item = sections.find(s => s.id === srcId)?.items.find(i => i.id === itemId)
    if (!item) return
    const next = sections.map(s => {
      if (s.id === srcId) return { ...s, items: s.items.filter(i => i.id !== itemId) }
      if (s.id === tgtId) return { ...s, items: [...s.items, item] }
      return s
    })
    persistPersonal(next)
    set({ personalSections: next })
    get().syncPersonalToDb()
  },

  // ── Tambah shared section (admin saja) ────────────────────
  addSharedSection: async (data) => {
    await createSharedSection(data)
    await get().loadSharedSections() // reload setelah tambah
  },

  // ── Update shared section (admin saja) ────────────────────
  updateSharedSectionFn: async (id, updates) => {
    await updateSharedSection(id, updates)
    await get().loadSharedSections()
  },

  // ── Hapus shared section (admin saja) ─────────────────────
  deleteSharedSectionFn: async (id) => {
    await deleteSharedSection(id)
    await get().loadSharedSections()
  },

  // ── Toggle favorite section ──────────────────────────────────
  // Tandai section sebagai favorit — akan tampil di urutan pertama group OWN
  toggleFavoriteSection: (id: string) => {
    const next = get().personalSections.map(s =>
      s.id === id ? { ...s, isFavorite: !s.isFavorite } : s
    )
    persistPersonal(next)
    set({ personalSections: next })
    get().syncPersonalToDb()
  },

  // ── Toggle favorite item/link ──────────────────────────────
  // Tandai link sebagai favorit — badge ⭐ muncul di pojok icon
  toggleFavoriteItem: (sectionId: string, itemId: string) => {
    const next = get().personalSections.map(s => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        items: s.items.map(i =>
          i.id === itemId ? { ...i, isFavorite: !i.isFavorite } : i
        )
      }
    })
    persistPersonal(next)
    set({ personalSections: next })
    get().syncPersonalToDb()
  },

  // ── Toggle edit mode ──────────────────────────────────────
  toggleEditMode: () => set(s => ({ editMode: !s.editMode, searchQuery: '' })),

  // ── Set query filter pencarian section ────────────────────
  setSearch: (q) => set({ searchQuery: q }),

  // ── Set filter preview untuk admin (role + region + unit) ─
  setPreviewFilter: (filter) => set({ previewFilter: filter }),

  // ── Update preferensi tampilan user ──────────────────────
  setAppearance: (o) => {
    const next = { ...get().appearance, ...o }
    saveLocalAppearance(next) // simpan ke localStorage langsung
    set({ appearance: next })
    // Sync ke DB dengan debounce 2 detik
    const userId = get().currentUserId
    if (userId) {
      if (appearanceSyncTimer) clearTimeout(appearanceSyncTimer)
      appearanceSyncTimer = setTimeout(() => saveUserAppearance(userId, next), 2000)
    }
  },

  // ── Update pilihan tampilan (show desc, show tags) ────────
  setDisplayOptions: (o) => set(s => ({ displayOptions: { ...s.displayOptions, ...o } })),

  // ── Set theme global (superadmin saja) ───────────────────
  setGlobalTheme: (theme) => {
    saveGlobalTheme(theme)     // simpan ke DB
    applyThemeToDOM(theme)     // terapkan ke CSS variables
    set({ globalTheme: theme })
    get().setAppearance({ theme }) // sinkron ke appearance user
  },

  // ── Simpan preset tampilan ────────────────────────────────
  savePreset: (name) => {
    const preset = { id: uid(), name, appearance: { ...get().appearance } }
    const presets = [...get().presets, preset]
    localStorage.setItem('jateamhub-presets', JSON.stringify(presets))
    set({ presets })
  },

  // ── Terapkan preset tampilan yang dipilih ─────────────────
  applyPreset: (id) => {
    const preset = get().presets.find(p => p.id === id)
    if (preset) get().setAppearance(preset.appearance)
  },

  // ── Hapus preset tampilan ─────────────────────────────────
  deletePreset: (id) => {
    const presets = get().presets.filter(p => p.id !== id)
    localStorage.setItem('jateamhub-presets', JSON.stringify(presets))
    set({ presets })
  },

  // ── Undo: kembalikan ke state sebelumnya ──────────────────
  undo: () => {
    const { history, personalSections, future } = get()
    if (!history.length) return
    const prev       = history[history.length - 1]
    const newHistory = history.slice(0, -1)
    const newFuture  = [structuredClone(personalSections), ...future].slice(0, MAX_HISTORY)
    persistPersonal(prev)
    set({ personalSections: prev, history: newHistory, future: newFuture,
          canUndo: newHistory.length > 0, canRedo: true })
  },

  // ── Redo: maju ke state berikutnya ───────────────────────
  redo: () => {
    const { history, personalSections, future } = get()
    if (!future.length) return
    const next       = future[0]
    const newFuture  = future.slice(1)
    const newHistory = [...history, structuredClone(personalSections)].slice(-MAX_HISTORY)
    persistPersonal(next)
    set({ personalSections: next, history: newHistory, future: newFuture,
          canUndo: true, canRedo: newFuture.length > 0 })
  },
}))

// ── Terapkan theme ke DOM — set data-theme + font per tema ────
export function applyThemeToDOM(theme: string) {
  // Map tema lama ke tema baru
  const legacyMap: Record<string, string> = {
    'dark-mint':  'obsidian',
    'dark-soft':  'aurora-dark',
    'enterprise': 'slate-dark',
    'pearl':      'aurora-light',
    'ivory':      'aurora-light',
    'sage':       'slate-light',
    'pearl-light':'aurora-light',
    'pearl-dark': 'aurora-dark',
    'ivory-light':'slate-light',
    'ivory-dark': 'slate-dark',
    'sage-light': 'slate-light',
    'sage-dark':  'slate-dark',
  }
  const resolvedTheme = legacyMap[theme] ?? theme

  // Terapkan data-theme
  document.documentElement.setAttribute('data-theme', resolvedTheme)

  // Font per tema
  const fontMap: Record<string, string> = {
    'aurora-light': "'Inter', sans-serif",
    'aurora-dark':  "'Inter', sans-serif",
    'sand-light':   "'Lora', serif",
    'sand-dark':    "'Lora', serif",
    'slate-light':  "'IBM Plex Sans', sans-serif",
    'slate-dark':   "'IBM Plex Sans', sans-serif",
    'obsidian':     "'Space Grotesk', sans-serif",
  }
  const font = fontMap[resolvedTheme]
  if (font) document.documentElement.style.setProperty('--font', font)
}
