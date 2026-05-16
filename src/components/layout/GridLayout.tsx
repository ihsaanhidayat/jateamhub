import { useMemo, useCallback, useState, useEffect } from 'react'
import RGL, { WidthProvider } from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import SectionCard from '../section/SectionCard'
import SectionModal from '../section/SectionModal'
import ItemModal from '../item/ItemModal'
import ClockWidget from '../widgets/ClockWidget'
import NotesWidget from '../widgets/NotesWidget'
import type { Section, LinkItem } from '../../types'
import { GRID_ROW_HEIGHT, SECTION_MIN_W, SECTION_MIN_H, SECTION_DEFAULT_W, SECTION_DEFAULT_H } from '../../types'
import { canEdit, canViewSection } from '../../utils/roles'

const ADD_KEY = '__add_section__'

const ReactGridLayout = WidthProvider(RGL)


// Deteksi mobile
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

export default function GridLayout() {
  const { config, editMode, batchUpdateLayouts, searchQuery, currentPage, previewUnit } = useStore()
  const { profile: session } = useAuthStore()
  const isMobile = useIsMobile()

  const isEditable = canEdit(session as any)
  const isUnitAdmin = (session as any)?.is_unit_admin === true && (session as any)?.role === 'user'
  const myUnit = (session as any)?.unit_id ?? ''

  const canEditSection = (s: Section) => {
    if (isEditable) return true
    if (!isUnitAdmin) return false
    return (s.targetUnits ?? []).includes(myUnit)
  }

  const effectiveUnit = (previewUnit ?? (session as any)?.unit_id ?? '') as import('../../types').UnitId
  const effectiveSession = previewUnit !== null
    ? { username: session?.username ?? '', role: 'user' as const, unit_id: effectiveUnit, unitId: effectiveUnit, remember: 'never' as const }
    : session

  const [sectionModal, setSectionModal] = useState<{ open: boolean; section: Section | null }>({ open: false, section: null })
  const [itemModal, setItemModal] = useState<{ open: boolean; sectionId: string; item: LinkItem | null }>({ open: false, sectionId: '', item: null })

  const pageSections = useMemo(() => {
    const UNIT_PAGES = ['pro', 'cro', 'klaim']
    const isUnitPage = UNIT_PAGES.includes(currentPage)

    const filtered = config.sections.filter(s => {
      const sPageId = s.pageId ?? 'beranda'
      const sVis = s.visibility ?? 'all'
      const sUnits = s.targetUnits ?? []

      if (previewUnit === null && isEditable) {
        if (!isUnitPage) return sPageId === currentPage && sVis !== 'unit'
        return sPageId === currentPage || sUnits.includes(currentPage)
      }

      // unit_admin — lihat section miliknya juga
      if (isUnitAdmin && previewUnit === null) {
        const onPage = sPageId === currentPage
        const isMyUnit = sVis === 'unit' && sUnits.includes(myUnit) && currentPage === 'beranda'
        if (!onPage && !isMyUnit) return false
        return canViewSection(effectiveSession, sVis, sUnits) || canEditSection(s)
      }

      const userUnit = (effectiveSession as any)?.unit_id ?? (effectiveSession as any)?.unitId ?? ''
      const isSharedToUser = sVis === 'unit' && sUnits.includes(userUnit) && currentPage === 'beranda'
      const onPage = sPageId === currentPage || isSharedToUser
      if (!onPage) return false
      return canViewSection(effectiveSession, sVis, sUnits)
    })

    return filtered.sort((a, b) => {
      const order = { all: 0, admin: 1, unit: 2 }
      const ao = order[a.visibility ?? 'all'] ?? 0
      const bo = order[b.visibility ?? 'all'] ?? 0
      return ao - bo
    })
  }, [config.sections, currentPage, session, previewUnit, isEditable, isUnitAdmin, myUnit, effectiveSession])

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



  const canEditAnything = isEditable || isUnitAdmin

  const rglLayout: Layout[] = useMemo(() => {
    const COLS = 12
    let col = 0, row = 0, rowH = 0
    const normalized = pageSections.map(s => {
      const w = Math.min(s.layout.w ?? SECTION_DEFAULT_W, COLS)
      const h = s.collapsed ? 1 : (s.layout.h ?? SECTION_DEFAULT_H)
      if (col + w > COLS) { row += rowH; col = 0; rowH = 0 }
      const pos = { x: col, y: row, w, h }
      col += w; rowH = Math.max(rowH, h)
      return pos
    })

    const base = pageSections.map((s, i) => ({
      i: s.id,
      x: normalized[i].x, y: normalized[i].y,
      w: normalized[i].w, h: normalized[i].h,
      minW: SECTION_MIN_W,
      minH: s.collapsed ? 1 : SECTION_MIN_H,
      maxH: s.collapsed ? 1 : undefined,
      isDraggable: canEditSection(s) && editMode,
      isResizable: canEditSection(s) && editMode && !s.collapsed,
      resizeHandles: ['se'] as ['se'],
    }))


    return base
  }, [pageSections, editMode, isEditable, isUnitAdmin, previewUnit])

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    if (!canEditAnything || !editMode) return
    const pageSecIds = new Set(pageSections.map(s => s.id))
    const updates = newLayout
      .filter(item => item.i !== ADD_KEY && pageSecIds.has(item.i))
      .map(item => ({ id: item.i, layout: { x: item.x, y: item.y, w: item.w, h: item.h } }))
    batchUpdateLayouts(updates)
  }, [canEditAnything, editMode, batchUpdateLayouts, pageSections])

  const isEmpty = pageSections.length === 0

  const sectionCardProps = (section: Section) => ({
    section,
    canEdit: canEditSection(section),
    onEditSection: (s: Section) => setSectionModal({ open: true, section: s }),
    onEditItem: (sId: string, item: LinkItem) => setItemModal({ open: true, sectionId: sId, item }),
    onAddItem: (sId: string) => setItemModal({ open: true, sectionId: sId, item: null }),
  })

  const renderSection = (section: Section) => {
    if (section.type === 'widget') {
      return (
        <WidgetWrapper
          section={section}
          editMode={canEditSection(section) && editMode}
          onEdit={s => setSectionModal({ open: true, section: s })}
        />
      )
    }
    return <SectionCard {...sectionCardProps(section)} />
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div className="mobile-grid">
          {isEmpty && !editMode ? (
            <div className="empty-state">
              <div style={{ fontSize: 36, opacity: .3 }}>📄</div>
              <div>Halaman ini kosong</div>
            </div>
          ) : (
            pageSections.map(section => (
              <div
                key={section.id}
                className="mobile-section"
                style={{ opacity: q && !visibleSectionIds.has(section.id) ? 0.2 : 1, position: 'relative', paddingTop: 10 }}
              >
                <SectionBadge section={section} isAdmin={isEditable} />
                {renderSection(section)}
              </div>
            ))
          )}

          {canEditAnything && editMode && (
            <button
              className="mobile-add-section"
              onClick={() => setSectionModal({ open: true, section: null })}
            >
              ＋ Add Section
            </button>
          )}
        </div>

        <SectionModal open={sectionModal.open} section={sectionModal.section} onClose={() => setSectionModal({ open: false, section: null })} />
        <ItemModal open={itemModal.open} sectionId={itemModal.sectionId} item={itemModal.item} onClose={() => setItemModal({ open: false, sectionId: '', item: null })} />
      </>
    )
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────
  return (
    <>
      {isEmpty && !editMode ? (
        <div className="empty-state">
          <div style={{ fontSize: 40, opacity: .3 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Halaman ini kosong</div>
          <div style={{ fontSize: 12, color: 'var(--silver3)' }}>Login sebagai admin dan aktifkan Edit Mode untuk menambah section.</div>
        </div>
      ) : (
        <ReactGridLayout
          className="rgl-grid"
          layout={rglLayout} cols={12}
          rowHeight={GRID_ROW_HEIGHT} margin={[12, 12]}
          containerPadding={[0, 0]}
          onLayoutChange={handleLayoutChange}
          isDraggable={canEditAnything && editMode}
          isResizable={canEditAnything && editMode}
          draggableHandle=".section-header"
          resizeHandles={['se']} useCSSTransforms
          compactType="vertical" preventCollision={false} isBounded={false}
        >
          {pageSections.map(section => (
            <div key={section.id} style={{
              opacity: q && !visibleSectionIds.has(section.id) ? 0.2 : 1,
              transition: 'opacity .2s',
              position: 'relative',
              paddingTop: 10,
            }}>
              <SectionBadge section={section} isAdmin={isEditable} />
              {renderSection(section)}
            </div>
          ))}


        </ReactGridLayout>
      )}

      {isEmpty && canEditAnything && editMode && (
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

// Badge section — di luar section card, tidak terpotong overflow
function SectionBadge({ section, isAdmin }: { section: Section; isAdmin: boolean }) {
  const vis = section.visibility ?? 'all'
  if (vis === 'admin' && !isAdmin) return null

  const BADGE: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
    all: { label: 'ALL', color: '#0A0A0A', bg: '#00FFC2', border: '#00FFC2', glow: 'rgba(0,255,194,0.5)' },
    admin: { label: 'ADM', color: '#0A0A0A', bg: '#00BFFF', border: '#00BFFF', glow: 'rgba(0,191,255,0.5)' },
    unit: {
      label: (section.targetUnits ?? []).map(u => u.toUpperCase()).join('/') || 'UNIT',
      color: '#0A0A0A', bg: '#C77DFF', border: '#C77DFF', glow: 'rgba(199,125,255,0.5)',
    },
  }
  const b = BADGE[vis]
  if (!b) return null

  return (
    <span style={{
      position: 'absolute', top: 0, left: 12, zIndex: 10,
      fontSize: 8, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
      background: b.bg, color: b.color, border: `1px solid ${b.border}`,
      letterSpacing: '1px', textTransform: 'uppercase',
      fontFamily: 'var(--mono)', lineHeight: 1.5,
      pointerEvents: 'none',
      boxShadow: `0 0 8px ${b.glow}, 0 1px 3px rgba(0,0,0,0.4)`,
    }}>{b.label}</span>
  )
}

function WidgetWrapper({ section, editMode, onEdit }: { section: Section; editMode: boolean; onEdit: (s: Section) => void }) {
  const { toggleCollapse } = useStore()
  const accent = section.accentColor || 'var(--mint)'
  return (
    <div className="section-card" style={{ '--section-accent': accent, height: '100%', display: 'flex', flexDirection: 'column' } as React.CSSProperties}>
      <div className="section-header" style={{ cursor: editMode ? 'grab' : 'default', padding: '9px 12px 9px 15px' }}>
        <span className="section-icon">{section.icon || '🧩'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="section-title">{section.title}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          {editMode && (
            <button className="sec-action-btn" onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit(section) }}>✏️</button>
          )}
          <button className={`sec-collapse-btn${section.collapsed ? '' : ' open'}`} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); toggleCollapse(section.id) }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        border: `1px dashed ${hovered ? 'rgba(0,255,194,0.6)' : 'rgba(0,255,194,0.18)'}`,
        borderRadius: 'var(--radius)',
        background: hovered ? 'rgba(0,255,194,0.06)' : 'rgba(0,255,194,0.01)',
        cursor: 'pointer', transition: 'all .2s',
        color: hovered ? 'var(--mint)' : 'rgba(0,255,194,0.35)',
        userSelect: 'none',
        boxShadow: hovered ? '0 0 12px rgba(0,255,194,0.08), inset 0 0 12px rgba(0,255,194,0.04)' : 'none',
      }}>
      <div style={{
        width: 28, height: 28,
        border: `1px dashed ${hovered ? 'rgba(0,255,194,0.8)' : 'rgba(0,255,194,0.25)'}`,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 300, lineHeight: 1,
        transition: 'all .2s',
        boxShadow: hovered ? '0 0 8px rgba(0,255,194,0.3)' : 'none',
      }}>＋</div>
      <span style={{
        fontSize: 8, fontWeight: 700, letterSpacing: '1.5px',
        textTransform: 'uppercase', fontFamily: 'var(--mono)',
      }}>ADD SECTION</span>
    </div>
  )
}
