import { useMemo, useCallback, useState } from 'react'
import RGL, { WidthProvider } from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
import { useStore } from '../../store/dashboardStore'
import SectionCard from '../section/SectionCard'
import SectionModal from '../section/SectionModal'
import ItemModal from '../item/ItemModal'
import ClockWidget from '../widgets/ClockWidget'
import NotesWidget from '../widgets/NotesWidget'
import type { Section, LinkItem } from '../../types'
import { GRID_ROW_HEIGHT, SECTION_MIN_W, SECTION_MIN_H, SECTION_DEFAULT_W, SECTION_DEFAULT_H } from '../../types'
import { canEdit, canViewSection } from '../../utils/roles'
import { useAuthStore } from '../../store/authStore'

const ReactGridLayout = WidthProvider(RGL)
const ADD_KEY = '__add_section__'

export default function GridLayout() {
  const { config, editMode, batchUpdateLayouts, searchQuery, currentPage, previewUnit } = useStore()
  const { profile: session } = useAuthStore()

  const isEditable    = canEdit(session as any)
  const isUnitAdmin   = (session as any)?.is_unit_admin === true && (session as any)?.role === 'user'
  const myUnit        = (session as any)?.unit_id ?? ''
  // unit_admin bisa edit section yang targetUnits includes unit mereka
  const canEditSection = (s: import('../../types').Section) => {
    if (isEditable) return true
    if (!isUnitAdmin) return false
    return (s.targetUnits ?? []).includes(myUnit)
  }
  // Effective unit & session — pakai previewUnit kalau admin lagi preview
  const sessionUnit = (session as any)?.unit_id ?? (session as any)?.unitId ?? ''
  const effectiveUnit = (previewUnit ?? sessionUnit) as import('../../types').UnitId
  // SessionLike minimal — cukup untuk canViewSection
  const effectiveSession = previewUnit !== null
    ? { role: 'user' as const, unit_id: effectiveUnit, unitId: effectiveUnit, username: session?.username ?? '', remember: 'never' as const }
    : session

  const [sectionModal, setSectionModal] = useState<{ open: boolean; section: Section | null }>({ open: false, section: null })
  const [itemModal,    setItemModal]    = useState<{ open: boolean; sectionId: string; item: LinkItem | null }>({ open: false, sectionId: '', item: null })

  // Filter sections:
  // 1. Hanya di currentPage
  // 2. Visible untuk effective session
  // 3. Sort: all/shared dulu, lalu admin, lalu unit-specific
  const pageSections = useMemo(() => {
    // Halaman unit (pro/cro/klaim) — admin perlu lihat section yang assigned ke unit ini
    const UNIT_PAGES = ['pro', 'cro', 'klaim']
    const isUnitPage = UNIT_PAGES.includes(currentPage)

    const filtered = config.sections.filter(s => {
      const sPageId    = s.pageId ?? 'beranda'
      const sVis       = s.visibility ?? 'all'
      const sUnits     = s.targetUnits ?? []

      if (previewUnit === null && isEditable) {
        // Admin di halaman unit (preview via options) — tidak masuk sini karena previewUnit null
        // Admin di halaman BERANDA → hanya tampil section visibility=all atau admin
        // Section visibility=unit tidak tampil di BERANDA admin (dikelola via SectionModal)
        if (!isUnitPage) {
          return sPageId === currentPage && sVis !== 'unit'
        }
        // Admin di halaman unit (jika masih ada) → lihat section yang relevan untuk unit itu
        return sPageId === currentPage || sUnits.includes(currentPage)
      }

      // Preview mode atau user biasa
      // Section tampil kalau:
      // 1. pageId sama dengan halaman aktif, ATAU
      // 2. Section visibility=unit dengan targetUnits includes unit user (tampil di beranda)
      const userUnit = (effectiveSession as any)?.unit_id ?? (effectiveSession as any)?.unitId ?? ''
      const isSharedToUser = sVis === 'unit' && sUnits.includes(userUnit) && currentPage === 'beranda'
      const onPage = sPageId === currentPage || isSharedToUser
      if (!onPage) return false
      return canViewSection(effectiveSession, sVis, sUnits)
    })

    // Sort: visibility=all dulu (shared), lalu admin, lalu unit
    return filtered.sort((a, b) => {
      const order = { all: 0, admin: 1, unit: 2 }
      const ao = order[a.visibility ?? 'all'] ?? 0
      const bo = order[b.visibility ?? 'all'] ?? 0
      return ao - bo
    })
  }, [config.sections, currentPage, session, previewUnit, isEditable, effectiveSession])

  // Search filter
  const q = searchQuery.toLowerCase()
  const visibleSectionIds = useMemo(() => {
    if (!q) return new Set(pageSections.map(s => s.id))
    return new Set(
      pageSections.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.subtitle && s.subtitle.toLowerCase().includes(q)) ||
        s.items.some(i =>
          i.title.toLowerCase().includes(q) ||
          (i.desc && i.desc.toLowerCase().includes(q)) ||
          i.tags.some(t => t.toLowerCase().includes(q))
        )
      ).map(s => s.id)
    )
  }, [pageSections, q])

  // Add Section ghost — di akhir, ikuti ukuran section tetangga
  const addButtonLayout: Layout = useMemo(() => {
    if (!pageSections.length) return { i: ADD_KEY, x: 0, y: 0, w: SECTION_DEFAULT_W, h: SECTION_DEFAULT_H }
    const maxY = pageSections.reduce((m, s) => Math.max(m, s.layout.y + s.layout.h), 0)
    const bottomSections = pageSections.filter(s => s.layout.y + s.layout.h === maxY)
    const rightmost = bottomSections.reduce<Section | null>((prev, s) =>
      !prev || (s.layout.x + s.layout.w) > (prev.layout.x + prev.layout.w) ? s : prev, null)
    const refW = rightmost?.layout.w ?? SECTION_DEFAULT_W
    const refH = rightmost ? Math.max(rightmost._expandedH ?? rightmost.layout.h, SECTION_MIN_H) : SECTION_DEFAULT_H
    const rightmostX = rightmost ? rightmost.layout.x + rightmost.layout.w : 0
    const refY = rightmost?.layout.y ?? 0
    if (rightmostX + refW <= 12) return { i: ADD_KEY, x: rightmostX, y: refY, w: refW, h: refH }
    const firstInBottom = bottomSections.reduce<Section | null>((prev, s) =>
      !prev || s.layout.x < prev.layout.x ? s : prev, null)
    return {
      i: ADD_KEY, x: 0, y: maxY,
      w: firstInBottom?.layout.w ?? SECTION_DEFAULT_W,
      h: firstInBottom ? Math.max(firstInBottom._expandedH ?? firstInBottom.layout.h, SECTION_MIN_H) : SECTION_DEFAULT_H,
    }
  }, [pageSections])

  const rglLayout: Layout[] = useMemo(() => {
    // Normalize layout — re-assign posisi grid agar tidak clash
    // Section dari pageId berbeda (tampil karena targetUnits) bisa punya posisi konflik
    // Solusi: pack ulang secara sequential dari kiri-ke-kanan, atas-ke-bawah
    const COLS = 12
    let col = 0, row = 0, rowH = 0
    const normalized = pageSections.map(s => {
      const w = Math.min(s.layout.w ?? SECTION_DEFAULT_W, COLS)
      const h = s.collapsed ? 1 : (s.layout.h ?? SECTION_DEFAULT_H)
      // Kalau tidak muat di baris ini, pindah ke baris baru
      if (col + w > COLS) { row += rowH; col = 0; rowH = 0 }
      const pos = { x: col, y: row, w, h }
      col += w
      rowH = Math.max(rowH, h)
      return pos
    })

    const base = pageSections.map((s, i) => ({
      i: s.id,
      x: normalized[i].x,
      y: normalized[i].y,
      w: normalized[i].w,
      h: normalized[i].h,
      minW: SECTION_MIN_W,
      minH: s.collapsed ? 1 : SECTION_MIN_H,
      maxH: s.collapsed ? 1 : undefined,
      isDraggable:   (isEditable || (isUnitAdmin && canEditSection(s))) && editMode,
      isResizable:   (isEditable || (isUnitAdmin && canEditSection(s))) && editMode && !s.collapsed,
      resizeHandles: ['se'] as ['se'],
    }))
    if ((isEditable || isUnitAdmin) && editMode) {
      // Add button — taruh setelah section terakhir
      const lastNorm = normalized[normalized.length - 1]
      const lastW = lastNorm?.w ?? SECTION_DEFAULT_W
      const lastX = lastNorm ? lastNorm.x + lastNorm.w : 0
      const lastY = lastNorm?.y ?? 0
      const lastH = lastNorm?.h ?? SECTION_DEFAULT_H
      const addX = lastX + lastW <= COLS ? lastX : 0
      const addY = lastX + lastW <= COLS ? lastY : (lastNorm ? lastNorm.y + lastNorm.h : 0)
      base.push({
        i: ADD_KEY, x: addX, y: addY, w: lastW, h: lastH,
        minW: SECTION_MIN_W, minH: SECTION_MIN_H,
        maxH: undefined, isDraggable: false, isResizable: false, resizeHandles: ['se'] as ['se'],
      })
    }
    return base
  }, [pageSections, editMode, isEditable, previewUnit])

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    if (!isEditable || !editMode) return
    // Hanya update section yang ada di pageSections (bukan ADD_KEY)
    const pageSecIds = new Set(pageSections.map(s => s.id))
    const updates = newLayout
      .filter(item => item.i !== ADD_KEY && pageSecIds.has(item.i))
      .map(item => ({ id: item.i, layout: { x: item.x, y: item.y, w: item.w, h: item.h } }))
    batchUpdateLayouts(updates)
  }, [isEditable, editMode, batchUpdateLayouts, previewUnit, pageSections])

  const isEmpty = pageSections.length === 0

  return (
    <>
      {isEmpty && !editMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 12, color: 'var(--silver3)' }}>
          <div style={{ fontSize: 40, opacity: .3 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Halaman ini kosong</div>
          <div style={{ fontSize: 12 }}>Login sebagai admin dan aktifkan Edit Mode untuk menambah section.</div>
        </div>
      ) : (
        <ReactGridLayout
          className="rgl-grid"
          layout={rglLayout} cols={12}
          rowHeight={GRID_ROW_HEIGHT} margin={[12, 12]}
          containerPadding={[0, 0]}
          onLayoutChange={handleLayoutChange}
          isDraggable={(isEditable || isUnitAdmin) && editMode}
          isResizable={(isEditable || isUnitAdmin) && editMode}
          draggableHandle=".section-header"
          resizeHandles={['se']}
          useCSSTransforms
          compactType="vertical"
          preventCollision={false}
          isBounded={false}
        >
          {pageSections.map(section => (
            <div key={section.id} style={{ opacity: q && !visibleSectionIds.has(section.id) ? 0.2 : 1, transition: 'opacity .2s' }}>
              {section.type === 'widget' ? (
                <WidgetWrapper
                  section={section}
                  editMode={isEditable && editMode}
                  onEdit={s => setSectionModal({ open: true, section: s })}
                />
              ) : (
                <SectionCard
                  section={section}
                  canEdit={canEditSection(section)}
                  onEditSection={s => setSectionModal({ open: true, section: s })}
                  onEditItem={(sId, item) => setItemModal({ open: true, sectionId: sId, item })}
                  onAddItem={sId => setItemModal({ open: true, sectionId: sId, item: null })}
                />
              )}
            </div>
          ))}

          {(isEditable || isUnitAdmin) && editMode && (
            <div key={ADD_KEY}>
              <AddSectionCard onClick={() => setSectionModal({ open: true, section: null })} />
            </div>
          )}
        </ReactGridLayout>
      )}

      {isEmpty && (isEditable || isUnitAdmin) && editMode && (
        <div style={{ padding: 12 }}>
          <button className="add-section-card" style={{ width: '100%', maxWidth: 300 }}
            onClick={() => setSectionModal({ open: true, section: null })}>
            ＋ Add Section ke halaman ini
          </button>
        </div>
      )}

      <SectionModal open={sectionModal.open} section={sectionModal.section} onClose={() => setSectionModal({ open: false, section: null })} />
      <ItemModal open={itemModal.open} sectionId={itemModal.sectionId} item={itemModal.item} onClose={() => setItemModal({ open: false, sectionId: '', item: null })} />
    </>
  )
}

// Widget wrapper — header + widget content
function WidgetWrapper({ section, editMode, onEdit }: { section: Section; editMode: boolean; onEdit: (s: Section) => void }) {
  const { toggleCollapse } = useStore()
  const accent = section.accentColor || 'var(--mint)'
  return (
    <div className="section-card" style={{ '--section-accent': accent, height: '100%', display: 'flex', flexDirection: 'column' } as React.CSSProperties}>
      <div className="section-header" style={{ cursor: editMode ? 'grab' : 'default', padding: '9px 12px 9px 15px' }}>
        <span className="section-icon">{section.icon || '🧩'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="section-title">{section.title}</div>
          {section.subtitle && <div style={{ fontSize: 10, color: 'var(--silver3)', marginTop: 1 }}>{section.subtitle}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          {editMode && (
            <button className="sec-action-btn" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(section) }} title="Edit widget">✏️</button>
          )}
          <button className={`sec-collapse-btn${section.collapsed ? '' : ' open'}`} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); toggleCollapse(section.id) }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div className={`section-body${section.collapsed ? ' collapsed' : ''}`} style={{ flex: 1, overflow: 'hidden' }}>
        {section.widgetType === 'clock' && <ClockWidget />}
        {section.widgetType === 'notes' && <NotesWidget sectionId={section.id} />}
      </div>
    </div>
  )
}

function AddSectionCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
        border: `1px dashed ${hovered ? 'var(--mint)' : 'rgba(0,255,194,0.2)'}`,
        borderRadius: 'var(--radius)', background: hovered ? 'rgba(0,255,194,0.05)' : 'rgba(0,255,194,0.015)',
        cursor: 'pointer', transition: 'all .2s', color: hovered ? 'var(--mint)' : 'var(--silver3)', userSelect: 'none',
      }}>
      <div style={{ width: 38, height: 38, border: `1.5px dashed ${hovered ? 'var(--mint)' : 'rgba(0,255,194,0.25)'}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 300, lineHeight: 1, transition: 'all .2s' }}>＋</div>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Add Section</span>
    </div>
  )
}
