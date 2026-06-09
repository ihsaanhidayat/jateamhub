// ─────────────────────────────────────────────────────────────
// DASHBOARD STORE — State management layout dan tampilan dashboard
// Pisahan antara: section pribadi user + shared sections dari admin
// ─────────────────────────────────────────────────────────────
import { create } from 'zustand'
import type {
  Section, LinkItem, AppearanceSettings, ThemeId,
} from '../types'
import {
  SECTION_DEFAULT_W, SECTION_DEFAULT_H, DEFAULT_APPEARANCE,
} from '../types'
import {
  getUserLayout, saveUserLayout,
  getSharedSections, getAllSharedSections,
  createSharedSection, updateSharedSection, deleteSharedSection,
  saveUserAppearance, loadUserAppearance,
  saveGlobalTheme,
} from '../utils/supabaseClient'
import type { SharedSection } from '../utils/supabaseClient'

// ── Storage key constants ─────────────────────────────────────
const STORAGE_KEYS = {
  PERSONAL:    'jateamhub-personal',
  APPEARANCE:  'jateamhub-appearance',
  PRESETS:     'jateamhub-presets',
  DEVICE_PREF: 'jateamhub-device-pref',
} as const


// ── Konstanta ─────────────────────────────────────────────────
const CONFIG_VERSION  = '5.0'   // versi format config
const MAX_HISTORY     = 20      // maksimal langkah undo
const DATA_KEY        = STORAGE_KEYS.PERSONAL // key localStorage section pribadi
const APPEARANCE_KEY  = STORAGE_KEYS.APPEARANCE // key localStorage preferensi tampilan

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
  if (w < 768) {
    // Mobile: grid 5 kolom, icon medium
    return { itemDisplayMode: 'folderGrid', iconSize: 'medium', folderGridCols: 5 }
  }
  // Desktop: grid 5 kolom, icon large
  return { itemDisplayMode: 'folderGrid', iconSize: 'large', folderGridCols: 5 }
}
const DEVICE_PREF_KEY = STORAGE_KEYS.DEVICE_PREF
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
let _lastPersistedJson = ''
const persistPersonal = (sections: Section[]) => {
  try {
    const json = JSON.stringify(sections)
    if (json === _lastPersistedJson) return  // skip jika tidak ada perubahan
    _lastPersistedJson = json
    localStorage.setItem(DATA_KEY, json)
  } catch { /* storage full or unavailable */ }
}

// ── Debounce timer untuk sync ke DB ──────────────────────────
// Mutex dihapus — debounce sudah cukup sebagai protection
let personalSyncTimer:  ReturnType<typeof setTimeout> | null = null
let appearanceSyncTimer: ReturnType<typeof setTimeout> | null = null

// ── Tipe interface store ──────────────────────────────────────
interface DashboardStore {
  // -- State --
  personalSections: Section[]        // section pribadi user
  sharedSections:   SharedSection[]  // section dari admin (read-only)
  appearance:       AppearanceSettings
  editMode:         boolean
  searchQuery:      string
  notesLockActive:  boolean
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
  isSyncing:          boolean
  syncStatus:         'saved' | 'saving' | 'error' | 'idle'
  isDataInitialized:  boolean

  // -- Init & Load --
  initUser:    (userId: string, role: string, region: string, unit: string) => Promise<void>
  setCurrentUserId: (id: string | null | '') => void

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
  moveItem:   (srcId: string, itemId: string, tgtId: string, tgtItemId?: string) => void

  // -- Shared Sections (admin only) --
  loadSharedSections:    () => Promise<void>
  addSharedSection:      (data: Omit<SharedSection, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateSharedSectionFn: (id: string, updates: Partial<SharedSection>) => Promise<void>
  deleteSharedSectionFn: (id: string) => Promise<void>

  // -- Favorites --

  // -- UI State --
  toggleEditMode:    () => void
  reorderPersonalSections: (sections: Section[]) => void
  addPersonalSectionFirst: (data: Partial<Section>) => void
  setEditingSection: (s: Section | null) => void
  setEditingItem:    (v: { sectionId: string; item: any } | null) => void
  setAddingItem:     (sectionId: string | null) => void
  editingSection:    Section | null
  editingItem:       { sectionId: string; item: any } | null
  addingItemSectionId: string | null
  setSearch:         (q: string) => void

  // -- Tampilan / Appearance --
  setAppearance:     (o: Partial<AppearanceSettings>) => void
  setGlobalTheme:    (theme: ThemeId) => void

  // -- Presets --
  presets:       Array<{ id: string; name: string; appearance: Partial<AppearanceSettings> }>
  addPreset:     (name: string) => void
  applyPreset:   (id: string) => void
  removePreset:  (id: string) => void

  // -- Undo/Redo --
  undo: () => void
  redo: () => void

  // -- Sync --
  syncPersonalToDb:    () => void
  syncPersonalToDbNow: () => Promise<void>

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
  editMode:         false,
  editingSection:   null,
  editingItem:      null,
  addingItemSectionId: null,
  searchQuery:      '',
  notesLockActive:  false,
  currentUserId:    null,
  currentUserRole:  'user',
  currentRegion:    'global',
  currentUnit:      'general',
  globalTheme:      'parchment' as ThemeId,
  history:          [],
  presets:          [],
  future:           [],
  canUndo:          false,
  canRedo:          false,
  isDirty:           false,
  isSyncing:         false,
  isDataInitialized: false,
  syncStatus:       'idle',
  toasts:           [],

  // ── Toast: tampilkan notifikasi ───────────────────────────
  toast: (msg, type = 'success') => {
    const id = uid()
    set(s => ({ toasts: [...s.toasts.slice(-3), { id, msg, type }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  // ── Set ID user yang sedang login ─────────────────────────
  setCurrentUserId: (id) => {
    // Jika id null (logout), clear semua pending timers
    if (!id) {
      if (personalSyncTimer)  { clearTimeout(personalSyncTimer);  personalSyncTimer  = null }
      if (appearanceSyncTimer){ clearTimeout(appearanceSyncTimer); appearanceSyncTimer = null }
      set({ isDirty: false, syncStatus: 'idle', isSyncing: false })
    }
    if (!id) set({ isDataInitialized: false, currentUserId: '' })
    else set({ currentUserId: id as string })
  },

  // ── Init: load semua data saat user login ─────────────────
  // OPTIMASI: getUserLayout + getSharedSections + loadUserAppearance
  // dijalankan PARALLEL dengan Promise.all → ~150ms vs ~750ms sequential
  initUser: async (userId, role, region, unit) => {
    // Jangan re-init hanya jika userId SAMA dan data SUDAH ada
    if (get().currentUserId === userId && get().isDataInitialized) return
    // Reset state untuk user baru
    set({ currentUserId: userId, currentUserRole: role, currentRegion: region, currentUnit: unit, isDataInitialized: false, personalSections: [], sharedSections: [] })

    // Tema dari localStorage SEGERA — sinkron, tidak tunggu DB
    const localApp = loadLocalAppearance()
    if (localApp?.theme) {
      applyThemeToDOM(localApp.theme as string)
      set({ appearance: { ...DEFAULT_APPEARANCE, ...localApp } })
    } else {
      applyThemeToDOM('parchment')
    }

    // ── Parallel DB calls ─────────────────────────────────────
    let dbSections: unknown = null
    let shared:     unknown = null
    let dbAppearance: Record<string, unknown> | null = null
    try {
      const results = await Promise.all([
        getUserLayout(userId),
        getSharedSections(role, region, unit),
        loadUserAppearance(userId),
      ])
      dbSections   = results[0]
      shared       = results[1]
      dbAppearance = results[2] as Record<string, unknown> | null
    } catch {
      // Jaringan gagal — lanjutkan dengan data localStorage agar app tidak stuck
      get().toast('Gagal memuat data dari server — menggunakan data lokal.', 'warn')
    }

    // Process personal sections
    if (dbSections && Array.isArray(dbSections) && dbSections.length > 0) {
      const raw    = dbSections as Section[]
      const sorted = [...raw].sort((a, b) => (a.layout.y * 100 + a.layout.x) - (b.layout.y * 100 + b.layout.x))
      const sections = autoLayout(sorted)
      // Semua section default expanded saat login
      const withExpanded = sections.map(s => ({ ...s, collapsed: false }))
      persistPersonal(withExpanded)
      set({ personalSections: withExpanded })
      saveUserLayout(userId, sections).catch(() => {}) // simpan sections tanpa collapsed override
    } else {
      // DB kosong atau gagal — cek localStorage (mungkin ada data yang belum sync)
      const localRaw = localStorage.getItem(STORAGE_KEYS.PERSONAL)
      let localSections: Section[] = []
      try { localSections = localRaw ? JSON.parse(localRaw) : [] } catch { localSections = [] }

      if (localSections.length > 0) {
        // localStorage punya data — pakai ini dan push ke DB
        const sorted  = [...localSections].sort((a, b) => (a.layout.y * 100 + a.layout.x) - (b.layout.y * 100 + b.layout.x))
        const sections = autoLayout(sorted)
        persistPersonal(sections)
        set({ personalSections: sections })
        // Push ke DB agar tidak hilang lagi
        saveUserLayout(userId, sections).catch(() => {})
      } else {
        // Benar-benar kosong — user pertama kali login
        const genId = () => 's' + Math.random().toString(36).slice(2, 10)
        const defaultSections: Section[] = [
          {
            id: genId(), title: 'LAYANAN BERSAMA', icon: '🌐',
            subtitle: 'Layanan bersama', items: [],
            layout: { x: 0, y: 0, w: 4, h: 5 },
            visibility: 'all', targetUnits: [], pageId: 'beranda', type: 'section',
          },
          {
            id: genId(), title: 'FAVORIT', icon: '⭐',
            subtitle: 'Section pribadiku', items: [],
            layout: { x: 4, y: 0, w: 4, h: 5 },
            visibility: 'all', targetUnits: [], pageId: 'beranda', type: 'section',
          },
        ]
        persistPersonal(defaultSections)
        set({ personalSections: defaultSections })
        saveUserLayout(userId, defaultSections).catch(() => {})
      }
    }

    // Process shared sections
    if (Array.isArray(shared)) set({ sharedSections: shared })

    // Mark data sebagai selesai di-load — selalu, bahkan jika DB call gagal
    set({ isDataInitialized: true })

    // Process appearance dari DB (override localStorage jika ada)
    if (dbAppearance && Object.keys(dbAppearance).length > 0) {
      const merged = { ...DEFAULT_APPEARANCE, ...dbAppearance }
      // Paksa folderGridCols = 5 jika masih pakai default lama
      if (!dbAppearance.folderGridCols || (dbAppearance.folderGridCols as number) < 5) {
        merged.folderGridCols = 5
      }
      saveLocalAppearance(merged)
      set({ appearance: merged })
      if (merged.theme) applyThemeToDOM(merged.theme as string)
    } else {
      // Tidak ada appearance di DB — prioritaskan localStorage agar tema user tetap terjaga
      if (localApp && Object.keys(localApp).length > 0) {
        // User punya tema tersimpan — device preset hanya isi gap layout, bukan timpa tema
        const preset = getDevicePreset()
        const next = { ...DEFAULT_APPEARANCE, ...preset, ...localApp }
        saveLocalAppearance(next)
        set({ appearance: next })
        if (next.theme) applyThemeToDOM(next.theme as string)
      } else {
        // Benar-benar login pertama — tidak ada localStorage maupun DB → pakai device preset
        const preset = getDevicePreset()
        const next = { ...DEFAULT_APPEARANCE, ...preset }
        saveLocalAppearance(next)
        set({ appearance: next })
        setDevicePref()
      }
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

  // ── Sync ke DB — debounce 400ms, localStorage langsung ──
  syncPersonalToDb: () => {
    const { personalSections, currentUserId } = get()
    if (!currentUserId) return
    // Simpan ke localStorage seketika — data tidak hilang meski sync gagal
    persistPersonal(personalSections)
    set({ isDirty: true, syncStatus: 'saving' })
    // Batalkan sync sebelumnya, jadwalkan yang baru
    if (personalSyncTimer) clearTimeout(personalSyncTimer)
    personalSyncTimer = setTimeout(async () => {
      personalSyncTimer = null
      const { personalSections: latest, currentUserId: uid } = get()
      if (!uid) return
      set({ isSyncing: true })
      const safety = setTimeout(() => {
        if (get().isSyncing) set({ isSyncing: false, syncStatus: 'error', isDirty: true })
      }, 10000)
      const ok = await saveUserLayout(uid, latest)
      clearTimeout(safety)
      if (!get().currentUserId) return // user sudah logout saat sync berjalan
      set({ isSyncing: false, syncStatus: ok ? 'saved' : 'error', isDirty: !ok })
      if (!ok) get().toast('Gagal menyimpan ke server — data aman di perangkat', 'error')
      else setTimeout(() => { if (get().syncStatus === 'saved') set({ syncStatus: 'idle' }) }, 2000)
    }, 400)
  },

  // ── Sync langsung (untuk visibility change, pull-to-refresh) ──
  syncPersonalToDbNow: async () => {
    if (personalSyncTimer) { clearTimeout(personalSyncTimer); personalSyncTimer = null }
    const { personalSections, currentUserId } = get()
    if (!currentUserId || personalSections.length === 0) return
    persistPersonal(personalSections)
    set({ isSyncing: true, syncStatus: 'saving' })
    const safety = setTimeout(() => {
      if (get().syncStatus === 'saving') {
        set({ isSyncing: false, syncStatus: 'error', isDirty: true })
      }
    }, 10000)
    const ok = await saveUserLayout(currentUserId, personalSections)
    clearTimeout(safety)
    set({ isSyncing: false, syncStatus: ok ? 'saved' : 'error', isDirty: !ok })
    if (ok) setTimeout(() => { if (get().syncStatus === 'saved') set({ syncStatus: 'idle' }) }, 2000)
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
    // Debounce 800ms untuk drag/resize — lebih cepat dari 3 detik tapi tidak spam
    if (personalSyncTimer) { clearTimeout(personalSyncTimer); personalSyncTimer = null }
    personalSyncTimer = setTimeout(async () => {
      personalSyncTimer = null
      const { currentUserId } = get()
      if (!currentUserId) return
      set({ isSyncing: true, syncStatus: 'saving' })
      const ok = await saveUserLayout(currentUserId, get().personalSections)
      if (!get().currentUserId) return
      set({ isSyncing: false, syncStatus: ok ? 'saved' : 'error', isDirty: !ok })
      if (!ok) get().toast('Gagal menyimpan layout — data aman di perangkat', 'error')
      else setTimeout(() => set({ syncStatus: 'idle' }), 2000)
    }, 800)
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
    const next = get().personalSections.map((s: Section) => {
      if (s.id !== sectionId) return s
      return {
        ...s,
        items: s.items.map((i: any) => i.id === itemId ? { id: itemId, ...data } : i)
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
  moveItem: (srcId, itemId, tgtId, tgtItemId?) => {
    const sections = get().personalSections
    const srcSection = sections.find(s => s.id === srcId)
    const item = srcSection?.items.find(i => i.id === itemId)
    if (!item) return

    const next = sections.map(s => {
      // Drag dalam section yang sama → reorder
      if (s.id === srcId && s.id === tgtId) {
        const items = s.items.filter(i => i.id !== itemId)
        if (tgtItemId) {
          const tgtIdx = items.findIndex(i => i.id === tgtItemId)
          if (tgtIdx >= 0) {
            items.splice(tgtIdx, 0, item)
            return { ...s, items }
          }
        }
        return { ...s, items: [...items, item] }
      }
      // Drag ke section lain
      if (s.id === srcId) return { ...s, items: s.items.filter(i => i.id !== itemId) }
      if (s.id === tgtId) {
        if (tgtItemId) {
          const items = [...s.items]
          const tgtIdx = items.findIndex(i => i.id === tgtItemId)
          if (tgtIdx >= 0) { items.splice(tgtIdx, 0, item); return { ...s, items } }
        }
        return { ...s, items: [...s.items, item] }
      }
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

  // ── Toggle edit mode ──────────────────────────────────────
  toggleEditMode: () => set(s => ({ editMode: !s.editMode, searchQuery: '' })),

  reorderPersonalSections: (sections: Section[]) => {
    const updated = sections.map((s, i) => ({ ...s, layout: { ...s.layout, y: i } }))
    persistPersonal(updated)
    set({ personalSections: updated })
    get().syncPersonalToDb()
  },

  addPersonalSectionFirst: (data: Partial<Section>) => {
    const { personalSections } = get()
    const newSection: Section = {
      id:          crypto.randomUUID(),
      title:       data.title       ?? 'Section',
      icon:        data.icon        ?? '📋',
      subtitle:    data.subtitle    ?? '',
      items:       data.items       ?? [],
      collapsed:   false,
      layout:      { x: 0, y: 0, w: data.layout?.w ?? SECTION_DEFAULT_W, h: data.layout?.h ?? SECTION_DEFAULT_H },
      visibility:  data.visibility  ?? 'all',
      targetUnits: data.targetUnits ?? [],
      pageId:      data.pageId      ?? 'beranda',
      type:        data.type        ?? 'section',
      ...(data.widgetType ? { widgetType: data.widgetType } : {}),
    } as Section
    // Geser semua section lain ke bawah
    const shifted = personalSections.map(s => ({ ...s, layout: { ...s.layout, y: s.layout.y + (newSection.layout.h + 1) } }))
    const updated = [newSection, ...shifted]
    persistPersonal(updated)
    set({ personalSections: updated })
    get().syncPersonalToDb()
  },

  setEditingSection: (s) => set({ editingSection: s }),
  setEditingItem: (v) => set({ editingItem: v }),
  setAddingItem: (sectionId) => set({ addingItemSectionId: sectionId }),

  // ── Set query filter pencarian section ────────────────────
  setSearch: (q) => set({ searchQuery: q }),
  setNotesLockActive: (v: boolean) => set({ notesLockActive: v }),

  // ── Set filter preview untuk admin (role + region + unit) ─

  // ── Update preferensi tampilan user ──────────────────────
  setAppearance: (o) => {
    const next = { ...get().appearance, ...o }
    saveLocalAppearance(next) // simpan ke localStorage langsung
    set({ appearance: next })
    if (o.theme) applyThemeToDOM(o.theme as string) // DOM selalu sinkron
    const userId = get().currentUserId
    if (userId) {
      if (appearanceSyncTimer) clearTimeout(appearanceSyncTimer)
      if (o.theme) {
        // Tema adalah state kritis — simpan ke DB SEKETIKA agar tidak hilang saat logout
        appearanceSyncTimer = null
        saveUserAppearance(userId, next).catch(() => {})
      } else {
        // Pengaturan lain (iconSize, folderGridCols, dll.) — debounce 2 detik sudah cukup
        appearanceSyncTimer = setTimeout(() => saveUserAppearance(userId, next), 2000)
      }
    }
  },

  // ── Update pilihan tampilan (show desc, show tags) ────────

  // ── Set theme global (superadmin saja) ───────────────────
  setGlobalTheme: (theme) => {
    saveGlobalTheme(theme)     // simpan ke DB
    applyThemeToDOM(theme)     // terapkan ke CSS variables
    set({ globalTheme: theme })
    get().setAppearance({ theme }) // sinkron ke appearance user
  },

  // ── Simpan preset tampilan ────────────────────────────────
  addPreset: (name: string) => {
    const preset = { id: uid(), name, appearance: { ...get().appearance } }
    const presets = [...(get().presets ?? []), preset]
    localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets))
    set({ presets })
  },

  // ── Terapkan preset tampilan yang dipilih ─────────────────
  applyPreset: (id: string) => {
    const preset = (get().presets ?? []).find((p: any) => p.id === id)
    if (preset) get().setAppearance(preset.appearance)
  },

  // ── Hapus preset tampilan ─────────────────────────────────
  removePreset: (id: string) => {
    const presets = (get().presets ?? []).filter((p: any) => p.id !== id)
    localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets))
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

// ── Terapkan theme ke DOM ─────────────────────────────────────
// CSS punya 4 [data-theme]: "midnight"/"slate" (dark) dan "parchment"/"pearl" (light); resolves to midnight/parchment
export function applyThemeToDOM(theme: string) {
  const darkThemes = ['obsidian', 'dark-mint', 'dark-soft', 'enterprise',
    'aurora-dark', 'sand-dark', 'slate-dark', 'pearl-dark', 'ivory-dark', 'sage-dark',
    'dark', 'slate', 'midnight']
  const resolvedTheme = darkThemes.includes(theme) ? 'midnight' : 'parchment'

  document.documentElement.setAttribute('data-theme', resolvedTheme)

  const font = resolvedTheme === 'midnight'
    ? "'Space Grotesk', sans-serif"
    : "'Plus Jakarta Sans', sans-serif"
  document.documentElement.style.setProperty('--font', font)
}

// ── Granular selectors — cegah unnecessary re-renders ─────────
// Gunakan selector ini di komponen untuk subscribe hanya ke data yang dibutuhkan
export const usePersonalSections = () => useStore(s => s.personalSections)
export const useSharedSections   = () => useStore(s => s.sharedSections)
export const useEditMode         = () => useStore(s => s.editMode)
export const useSearchQuery      = () => useStore(s => s.searchQuery)
export const useAppearance       = () => useStore(s => s.appearance)
export const useSyncStatus       = () => useStore(s => ({ syncStatus: s.syncStatus, isSyncing: s.isSyncing, isDirty: s.isDirty }))
