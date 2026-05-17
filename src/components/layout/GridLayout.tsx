// ─────────────────────────────────────────────────────────────
// GRIDLAYOUT — Render dashboard utama
// Shared sections (dari admin) di row pertama, terkunci
// Personal sections (milik user) di bawahnya, bebas drag/resize
// ─────────────────────────────────────────────────────────────
import { useMemo, useCallback, useState, useEffect } from 'react'
import RGL, { WidthProvider } from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import SectionCard   from '../section/SectionCard'
import SectionModal  from '../section/SectionModal'
import ItemModal     from '../item/ItemModal'
import ClockWidget   from '../widgets/ClockWidget'
import NotesWidget   from '../widgets/NotesWidget'
import type { Section, LinkItem } from '../../types'
import { GRID_ROW_HEIGHT, SECTION_DEFAULT_W, SECTION_DEFAULT_H } from '../../types'
import type { SharedSection } from '../../utils/supabaseClient'
import { canEdit } from '../../utils/roles'

// WidthProvider membuat RGL otomatis mengikuti lebar container
const ReactGridLayout = WidthProvider(RGL)

// Key khusus untuk ghost + section
const GHOST_ADD_KEY = '__add_section__'

// ── Deteksi mobile berdasarkan lebar layar ────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

// ── Konversi SharedSection ke format Section untuk render ─────
const sharedToSection = (s: SharedSection, x: number, y: number): Section => ({
  id:          `shared_${s.id}`,
  title:       s.title,
  icon:        s.icon,
  subtitle:    s.subtitle,
  items:       (s.items as LinkItem[]) ?? [],
  layout:      { x, y, w: s.layout_hint?.w ?? SECTION_DEFAULT_W, h: s.layout_hint?.h ?? SECTION_DEFAULT_H },
  visibility:  'all',
  targetUnits: [],
  pageId:      'beranda',
  accentColor: s.accent_color,
  type:        'section',
  collapsed:   false,
})

interface Props { onAddSection: () => void }

export default function GridLayout({ onAddSection }: Props) {
  const {
    personalSections, sharedSections,
    editMode, batchUpdateLayouts, searchQuery, toggleCollapse,
    addItem, updateItem, deleteItem, moveItem,
    deletePersonalSection, updatePersonalSection, toast,
    addPersonalSectionAuto,
  } = useStore()
  const { profile: session } = useAuthStore()
  const isMobile = useIsMobile()

  // Cek apakah user boleh edit (admin/superadmin atau semua user untuk section pribadi)
  const isAdminLevel = session?.role === 'admin' || session?.role === 'superadmin'

  // State untuk modal tambah/edit section dan item
  const [sectionModal, setSectionModal] = useState<{ open: boolean; section: Section | null }>({ open: false, section: null })
  const [itemModal,    setItemModal]    = useState<{ open: boolean; sectionId: string; item: LinkItem | null }>({ open: false, sectionId: '', item: null })

  // Filter query pencarian
  const q = searchQuery.toLowerCase()

  // ── Bangun layout RGL untuk shared sections (baris pertama, terkunci) ──
  const sharedLayouts = useMemo((): Layout[] => {
    const COLS = 12
    const layouts: Layout[] = []
    let col = 0, row = 0, rowH = 0

    sharedSections.forEach((s, i) => {
      const w = Math.min(s.layout_hint?.w ?? SECTION_DEFAULT_W, COLS)
      const h = s.layout_hint?.h ?? SECTION_DEFAULT_H
      if (col + w > COLS) { row += rowH; col = 0; rowH = 0 }
      layouts.push({
        i:           `shared_${s.id}`,
        x: col, y: row, w, h,
        isDraggable: false,  // shared section TIDAK bisa di-drag
        isResizable: false,  // shared section TIDAK bisa di-resize
        resizeHandles: [] as unknown as ['se'],
        minW: 1, minH: 1, maxH: undefined,
      })
      col += w; rowH = Math.max(rowH, h)
    })
    return layouts
  }, [sharedSections])

  // Tinggi total yang dipakai shared sections (untuk offset personal sections)
  const sharedRowsHeight = useMemo(() => {
    if (sharedLayouts.length === 0) return 0
    return sharedLayouts.reduce((max, l) => Math.max(max, l.y + l.h), 0)
  }, [sharedLayouts])

  // ── Bangun layout RGL — semua section dalam 1 grid berurutan ──
  const personalLayouts = useMemo((): Layout[] => {
    const COLS = 12
    const OFFSET_Y = 0 // semua section dalam 1 grid, tidak ada offset

    // Hitung posisi Y personal section (setelah semua shared sections)
    const sharedH = sharedRowsHeight  // tinggi total shared sections
    const layouts: Layout[] = personalSections.map(s => ({
      i:           s.id,
      x:           s.layout.x,
      y:           s.layout.y + sharedH,
      w:           s.layout.w,
      h:           s.collapsed ? 1 : s.layout.h,
      minW:        1,
      minH:        s.collapsed ? 1 : 2,
      maxH:        s.collapsed ? 1 : undefined,
      isDraggable: editMode,
      isResizable: editMode && !s.collapsed, // semua role bisa resize
      resizeHandles: ['se', 'e', 'w'] as unknown as ['se'],
    }))

    // Ghost + section: w:2, tinggi sama dengan section referensi
    // Jika ada personal section → di sebelah personal terakhir
    // Jika tidak ada personal → di sebelah shared section terakhir
    if (editMode) {
      const GHOST_W = 2
      if (personalSections.length > 0) {
        // Setelah personal section terakhir
        const last = [...personalSections].sort((a, b) =>
          (b.layout.y * 100 + b.layout.x + b.layout.w) -
          (a.layout.y * 100 + a.layout.x + a.layout.w)
        )[0]
        const afterX  = last.layout.x + last.layout.w
        const sameRow = afterX + GHOST_W <= COLS
        layouts.push({
          i: GHOST_ADD_KEY,
          x: sameRow ? afterX : 0,
          y: OFFSET_Y + (sameRow ? last.layout.y : last.layout.y + last.layout.h),
          w: GHOST_W, h: last.layout.h,
          minW: GHOST_W, minH: 2, maxH: undefined,
          isDraggable: false, isResizable: false,
          resizeHandles: [] as unknown as ['se'],
        })
      } else if (sharedLayouts.length > 0) {
        // Tidak ada personal → di sebelah shared terakhir (row pertama)
        const lastShared = sharedLayouts.reduce((max, l) =>
          (l.y * 100 + l.x + l.w > max.y * 100 + max.x + max.w) ? l : max, sharedLayouts[0])
        const afterX  = lastShared.x + lastShared.w
        const sameRow = afterX + GHOST_W <= COLS
        layouts.push({
          i: GHOST_ADD_KEY,
          x: sameRow ? afterX : 0,
          y: sameRow ? lastShared.y : lastShared.y + lastShared.h,
          w: GHOST_W, h: lastShared.h,
          minW: GHOST_W, minH: 2, maxH: undefined,
          isDraggable: false, isResizable: false,
          resizeHandles: [] as unknown as ['se'],
        })
      } else {
        // Tidak ada section sama sekali
        layouts.push({
          i: GHOST_ADD_KEY,
          x: 0, y: 0, w: 4, h: 3,
          minW: 2, minH: 2, maxH: undefined,
          isDraggable: false, isResizable: false,
          resizeHandles: [] as unknown as ['se'],
        })
      }
    }

    return layouts
  }, [personalSections, sharedRowsHeight, sharedLayouts, editMode])

  // Gabungkan layout shared + personal untuk RGL
  // Filter ghost jika bukan edit mode
  const allLayouts = useMemo(() => {
    const layouts = [...sharedLayouts, ...personalLayouts]
    return editMode ? layouts : layouts.filter(l => l.i !== GHOST_ADD_KEY)
  }, [sharedLayouts, personalLayouts, editMode])

  // ── Handler saat user drag/resize personal section ────────────
  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    if (!editMode) return
    const personalIds = new Set(personalSections.map(s => s.id))
    const updates = newLayout
      .filter(item => item.i !== GHOST_ADD_KEY && personalIds.has(item.i))
      .map(item => ({
        id:     item.i,
        layout: {
          x: item.x,
          y: item.y - sharedRowsHeight,
          w: item.w,
          h: item.h,
        }
      }))
    if (updates.length > 0) batchUpdateLayouts(updates)
  }, [editMode, personalSections, sharedRowsHeight, batchUpdateLayouts])

  // ── Render satu section (shared atau personal) ────────────────
  const renderSection = (section: Section, isShared: boolean) => {
    if (section.type === 'widget') {
      return (
        <WidgetWrapper
          section={section}
          editMode={!isShared && editMode}
          onEdit={s => setSectionModal({ open: true, section: s })}
        />
      )
    }
    return (
      <SectionCard
        section={section}
        isShared={isShared}            // shared = read-only, tidak bisa edit
        canEdit={!isShared && editMode}
        onEditSection={s  => setSectionModal({ open: true, section: s })}
        onEditItem={(sId, item) => setItemModal({ open: true, sectionId: sId, item })}
        onAddItem={sId  => setItemModal({ open: true, sectionId: sId, item: null })}
        onDeleteSection={id => { deletePersonalSection(id); toast('Section dihapus.', 'success') }}
        onToggleFavorite={id => useStore.getState().toggleFavoriteSection(id)}
        onToggleFavoriteItem={(sId, iId) => useStore.getState().toggleFavoriteItem(sId, iId)}
      />
    )
  }

  // ── Semua section diurutkan: ADM REG → ADM UNIT → OWN (favorit pertama) ────
  const allSections: Array<{
    section: Section;
    isShared: boolean;
    sharedSource?: import('../../utils/supabaseClient').SharedSection
  }> = useMemo(() => {
    // Shared sections diurutkan: region dulu, unit kedua
    const sharedRegion = sharedSections.filter(s => s.visibility === 'region')
    const sharedUnit   = sharedSections.filter(s => s.visibility === 'unit')
    const sortedShared = [...sharedRegion, ...sharedUnit]

    const shared = sortedShared.map((s) => ({
      section:      sharedToSection(s, 0, 0),
      isShared:     true,
      sharedSource: s,
    }))

    // Personal sections: favorit dulu, lalu sisanya
    const favSections  = personalSections.filter(s => s.isFavorite)
    const restSections = personalSections.filter(s => !s.isFavorite)
    const personal = [...favSections, ...restSections].map(s => ({ section: s, isShared: false }))

    return [...shared, ...personal]
  }, [sharedSections, personalSections])

  // ── Filter section berdasarkan search query ───────────────────
  const visibleIds = useMemo(() => {
    if (!q) return new Set(allSections.map(({ section }) => section.id))
    return new Set(
      allSections
        .filter(({ section: s }) =>
          s.title.toLowerCase().includes(q) ||
          (s.subtitle ?? '').toLowerCase().includes(q) ||
          s.items.some(i =>
            i.title.toLowerCase().includes(q) ||
            (i.desc ?? '').toLowerCase().includes(q)
          )
        )
        .map(({ section }) => section.id)
    )
  }, [allSections, q])

  // ── MOBILE LAYOUT — stack vertikal, tidak ada drag ────────────
  if (isMobile) {
    return (
      <>
        <div className="mobile-grid">
          {/* Shared sections dulu */}
          {sharedSections.map((s, i) => {
            const section = sharedToSection(s, 0, i)
            return (
              <div key={`shared_${s.id}`} className="mobile-section" style={{ position: 'relative', paddingTop: 10 }}>
                <SectionBadge sharedSection={s} />
                {renderSection(section, true)}
              </div>
            )
          })}
          {/* Personal sections */}
          {personalSections.map(section => (
            <div key={section.id} className="mobile-section"
              style={{ opacity: q && !visibleIds.has(section.id) ? 0.2 : 1, position: 'relative', paddingTop: 10 }}>
              {renderSection(section, false)}
            </div>
          ))}
          {/* Tombol tambah section di mobile saat edit mode */}
          {editMode && (
            <button className="mobile-add-section" onClick={() => addPersonalSectionAuto()}>
              ＋ Tambah Section
            </button>
          )}
        </div>

        <SectionModal open={sectionModal.open} section={sectionModal.section} onClose={() => setSectionModal({ open: false, section: null })} />
        <ItemModal open={itemModal.open} sectionId={itemModal.sectionId} item={itemModal.item} onClose={() => setItemModal({ open: false, sectionId: '', item: null })} />
      </>
    )
  }

  // ── DESKTOP LAYOUT — RGL dengan drag/resize ────────────────────
  return (
    <>
      {allSections.length === 0 && !editMode ? (
        // Tampilan kosong jika tidak ada section
        <div className="empty-state">
          <div style={{ fontSize: 40, opacity: .3 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Dashboard kosong</div>
          <div style={{ fontSize: 12, color: 'var(--silver3)' }}>
            Aktifkan Edit Mode untuk mulai menambah section.
          </div>
        </div>
      ) : (
        <ReactGridLayout
          className="rgl-grid"
          layout={allLayouts}
          cols={12}
          rowHeight={GRID_ROW_HEIGHT}
          margin={[20, 20]}
          containerPadding={[0, 0]}
          onLayoutChange={handleLayoutChange}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".section-header"
          resizeHandles={['se', 'e', 'w']}
          useCSSTransforms
          compactType="vertical"
          preventCollision={false}
        >
          {/* Render semua section */}
          {allSections.map(({ section, isShared, sharedSource }) => (
            <div
              key={section.id}
              style={{
                opacity: q && !visibleIds.has(section.id) ? 0.2 : 1,
                transition: 'opacity .2s',
                position: 'relative',
                paddingTop: 10,
              }}
            >
              {/* Badge: ADM REG/UNIT untuk shared, OWN+⭐ untuk personal */}
              <SectionBadge
                sharedSection={isShared ? (sharedSource ?? null) : null}
                personalSection={!isShared ? section : null}
              />
              {renderSection(section, isShared)}
            </div>
          ))}

          {/* Ghost + section untuk tambah section baru */}
          {editMode && (
            <div key={GHOST_ADD_KEY}>
              {/* Klik ghost → langsung tambah section tanpa modal */}
              <GhostAddSection onClick={() => addPersonalSectionAuto()} />
            </div>
          )}
        </ReactGridLayout>
      )}

      {/* Modal section */}
      <SectionModal
        open={sectionModal.open}
        section={sectionModal.section}
        onClose={() => setSectionModal({ open: false, section: null })}
      />
      {/* Modal item */}
      <ItemModal
        open={itemModal.open}
        sectionId={itemModal.sectionId}
        item={itemModal.item}
        onClose={() => setItemModal({ open: false, sectionId: '', item: null })}
      />
    </>
  )
}

// ── Ghost tambah section — kecil, dashed border ───────────────
function GhostAddSection({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px dashed ${hov ? 'var(--mint)' : 'rgba(0,255,194,0.2)'}`,
        borderRadius: 'var(--radius)',
        background: hov ? 'rgba(0,255,194,0.06)' : 'rgba(0,255,194,0.01)',
        cursor: 'pointer', transition: 'all .2s',
        color: hov ? 'var(--mint)' : 'rgba(0,255,194,0.3)',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: `1.5px dashed ${hov ? 'var(--mint)' : 'rgba(0,255,194,0.25)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, transition: 'all .2s',
      }}>＋</div>
    </div>
  )
}

// ── Badge section ─────────────────────────────────────────────
// ADM REG = dari admin regional, ADM UNIT = dari admin unit, OWN = milik user
function SectionBadge({ sharedSection, personalSection }: {
  sharedSection?: import('../../utils/supabaseClient').SharedSection | null
  personalSection?: Section | null
}) {
  // Badge untuk shared section
  if (sharedSection) {
    const SHARED_BADGE: Record<string, { label: string; bg: string; glow: string }> = {
      region: { label: 'ADM REG',  bg: '#FF8C42', glow: 'rgba(255,140,66,0.5)' },
      unit:   { label: 'ADM UNIT', bg: '#C77DFF', glow: 'rgba(199,125,255,0.5)' },
    }
    const b = SHARED_BADGE[sharedSection.visibility]
    if (!b) return null
    return (
      <span style={{
        position: 'absolute', top: 0, left: 12, zIndex: 10,
        fontSize: 8, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
        background: b.bg, color: '#0A0A0A', border: `1px solid ${b.bg}`,
        letterSpacing: '1px', textTransform: 'uppercase',
        fontFamily: 'var(--mono)', lineHeight: 1.5, pointerEvents: 'none',
        boxShadow: `0 0 8px ${b.glow}, 0 1px 3px rgba(0,0,0,0.4)`,
      }}>{b.label}</span>
    )
  }

  // Badge untuk personal section (OWN)
  if (personalSection) {
    return (
      <div style={{
        position: 'absolute', top: 0, left: 12, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'none',
      }}>
        <span style={{
          fontSize: 8, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
          background: '#4ADE80', color: '#0A0A0A', border: '1px solid #4ADE80',
          letterSpacing: '1px', textTransform: 'uppercase',
          fontFamily: 'var(--mono)', lineHeight: 1.5,
          boxShadow: '0 0 8px rgba(74,222,128,0.5), 0 1px 3px rgba(0,0,0,0.4)',
        }}>OWN</span>
        {/* ⭐ favorite badge di samping OWN */}
        {personalSection.isFavorite && (
          <span style={{
            fontSize: 10, lineHeight: 1,
            filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.8))',
          }}>⭐</span>
        )}
      </div>
    )
  }
  return null
}

// ── Widget wrapper (jam/catatan) ──────────────────────────────
function WidgetWrapper({ section, editMode, onEdit }: {
  section: Section; editMode: boolean; onEdit: (s: Section) => void
}) {
  const { toggleCollapse } = useStore()
  return (
    <div className="section-card" style={{
      '--section-accent': section.accentColor || 'var(--mint)',
      height: '100%', display: 'flex', flexDirection: 'column',
    } as React.CSSProperties}>
      <div className="section-header" style={{ cursor: editMode ? 'grab' : 'default' }}>
        <span className="section-icon">{section.icon || '🧩'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="section-title">{section.title}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          {editMode && (
            <button className="sec-action-btn-lg"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onEdit(section) }}>✏️</button>
          )}
          <button
            className={`sec-collapse-btn${section.collapsed ? '' : ' open'}`}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); toggleCollapse(section.id) }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div className={`section-body${section.collapsed ? ' collapsed' : ''}`}
        style={{ flex: 1, overflow: 'hidden' }}>
        {section.widgetType === 'clock' && <ClockWidget />}
        {section.widgetType === 'notes' && <NotesWidget sectionId={section.id} />}
      </div>
    </div>
  )
}
