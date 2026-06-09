// ─────────────────────────────────────────────────────────────
// GRIDLAYOUT v4.0 — CSS Grid + @dnd-kit/sortable
// Personal sections: draggable untuk reorder
// Shared sections: locked, tidak bisa drag
// ─────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import SectionCard from '../section/SectionCard'
import type { Section } from '../../types'
import NotesWidget from '../widgets/NotesWidget'
import TodoWidget, { TodoInputFooter } from '../widgets/TodoWidget'
import ClockWidget from '../widgets/ClockWidget'

// ── Skeleton dashboard ───────────────────────────────────────
function SkeletonDashboard() {
  return (
    <div className="dashboard-grid">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="section-card" style={{ height: 220 }}>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="skeleton" style={{ height: 16, width: '60%' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[...Array(8)].map((_, j) => (
                <div key={j} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10 }} />
                  <div className="skeleton" style={{ height: 10, width: 36 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Sortable wrapper untuk personal section ──────────────────
function SortableSectionCard({
  section, editMode, isMobile, searchQuery, focusedId, onFocus,
  isExpanded, onExpandTodo,
  onEditSection, onEditItem, onAddItem, onDeleteSection, onSave, onCancel,
}: {
  section: Section, editMode: boolean, isMobile: boolean, searchQuery: string,
  focusedId: string | null, onFocus: (id: string | null) => void,
  isExpanded?: boolean, onExpandTodo?: () => void,
  onEditSection: (s: Section) => void, onEditItem: (sid: string, item: any) => void,
  onAddItem: (sid: string) => void, onDeleteSection: (id: string) => void,
  onSave: () => void, onCancel: () => void,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const isFocused = focusedId === section.id
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  // Widget rendering (Notes, Clock)
  if (section.type === 'widget') {
    return (
      <div ref={setNodeRef} style={style}>
        <SectionCard
          section={section}
          isShared={false}
          canEdit={editMode}
          isFocused={isFocused}
          isMobileView={isMobile}
          dragHandleProps={editMode ? { ...attributes, ...listeners } : undefined}
          onFocus={onFocus}
          onEditSection={onEditSection}
          onEditItem={onEditItem}
          onAddItem={onAddItem}
          onDeleteSection={onDeleteSection}
          onSave={onSave}
          onCancel={onCancel}
          isExpanded={isExpanded}
          onExpandTodo={onExpandTodo}
          widgetContent={
            (section as any).widgetType === 'notes'
              ? <NotesWidget sectionId={section.id} />
              : (section as any).widgetType === 'clock'
              ? <ClockWidget />
              : (section as any).widgetType === 'todo'
              ? <TodoWidget sectionId={section.id} />
              : null
          }
          widgetFooter={
            (section as any).widgetType === 'todo'
              ? <TodoInputFooter sectionId={section.id} />
              : undefined
          }
        />
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style}>
      <SectionCard
        section={section}
        isShared={false}
        canEdit={editMode}
        isFocused={isFocused}
        isMobileView={isMobile}
        dragHandleProps={editMode ? { ...attributes, ...listeners } : undefined}
        onFocus={onFocus}
        onEditSection={onEditSection}
        onEditItem={onEditItem}
        onAddItem={onAddItem}
        onDeleteSection={onDeleteSection}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  )
}

// ── Detect mobile ────────────────────────────────────────────
const useIsMobile = () => {
  const [v, setV] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const h = () => setV(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return v
}

// ── Main component ───────────────────────────────────────────
export default function GridLayout({ onAddSection }: { onAddSection?: () => void }) {
  // Granular selectors — hanya re-render saat data ini berubah
  const personalSections  = useStore(s => s.personalSections)
  const sharedSections    = useStore(s => s.sharedSections)
  const editMode          = useStore(s => s.editMode)
  const searchQuery       = useStore(s => s.searchQuery)
  const isDataInitialized = useStore(s => s.isDataInitialized)
  const { profile } = useAuthStore()
  const isMobile = useIsMobile()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null)
  const [isDraggingActive, setIsDraggingActive] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  // Tutup focus saat edit mode mati
  useEffect(() => { if (!editMode) setFocusedId(null) }, [editMode])

  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(e.active.id as string)
    setIsDraggingActive(true)
  }, [])

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null)
    setIsDraggingActive(false)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const store = useStore.getState()
    const secs = store.personalSections
    const oldIdx = secs.findIndex(s => s.id === active.id)
    const newIdx = secs.findIndex(s => s.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    store.reorderPersonalSections(arrayMove(secs, oldIdx, newIdx))
  }, [])

  // Handlers
  const handleEditSection = useCallback((s: Section) => {
    useStore.getState().setEditingSection(s)
  }, [])
  const handleEditItem = useCallback((sectionId: string, item: any) => {
    useStore.getState().setEditingItem({ sectionId, item })
  }, [])
  const handleAddItem = useCallback((sectionId: string) => {
    useStore.getState().setAddingItem(sectionId)
  }, [])
  const handleDeleteSection = useCallback((id: string) => {
    const store = useStore.getState()
    store.deletePersonalSection(id)
    store.syncPersonalToDb()
  }, [])
  const handleSave = useCallback(() => {
    useStore.getState().syncPersonalToDb()
  }, [])
  const handleCancel = useCallback(() => {
    useStore.getState().setEditingSection(null)
    useStore.getState().setEditingItem(null)
  }, [])

  // Pull-to-refresh
  const [pullY, setPullY] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const PULL_THRESHOLD = 72

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) { touchStartY.current = e.touches[0].clientY; setIsPulling(true) }
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0 && window.scrollY === 0) setPullY(Math.min(delta * 0.5, PULL_THRESHOLD + 20))
  }
  const handleTouchEnd = async () => {
    setIsPulling(false)
    if (pullY >= PULL_THRESHOLD) {
      setIsRefreshing(true); setPullY(PULL_THRESHOLD)
      const safety = setTimeout(() => { setIsRefreshing(false); setPullY(0) }, 5000)
      try {
        await useStore.getState().syncPersonalToDbNow()
        if (useStore.getState().loadSharedSections) await useStore.getState().loadSharedSections()
      } catch {} finally { clearTimeout(safety); setIsRefreshing(false); setPullY(0) }
    } else { setPullY(0) }
  }

  const activeSection = personalSections.find(s => s.id === activeId)
  const q = searchQuery.toLowerCase()

  const sectionMatches = (section: Section) => {
    if (!q) return true
    return section.title.toLowerCase().includes(q) ||
      section.items.some((i: any) =>
        i.title.toLowerCase().includes(q) ||
        (i.url  && i.url.toLowerCase().includes(q)) ||
        (i.desc && i.desc.toLowerCase().includes(q))
      )
  }

  const totalMatchItems = [...sharedSections, ...personalSections].reduce((acc, s: any) => {
    if (!q) return acc
    return acc + (s.items ?? []).filter((i: any) =>
      i.title.toLowerCase().includes(q) ||
      (i.url  && i.url.toLowerCase().includes(q)) ||
      (i.desc && i.desc.toLowerCase().includes(q))
    ).length
  }, 0)

  if (!isDataInitialized) return <SkeletonDashboard />

  // Konversi shared sections ke Section format
  const sharedAsSections = sharedSections.map(s => ({
    id: `shared_${s.id}`,
    title: s.title,
    subtitle: s.subtitle ?? '',
    icon: s.icon ?? '📋',
    items: (s.items ?? []) as any,
    collapsed: false,
    layout: { x: 0, y: 0, w: 3, h: 5 },
    visibility: 'all' as const,
    targetUnits: [],
    pageId: 'beranda',
    type: 'section' as const,
  }))

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ paddingTop: pullY > 0 ? pullY : undefined, transition: isPulling ? 'none' : 'padding-top 300ms ease' }}
    >
      {/* Pull to refresh indicator */}
      {pullY > 0 && (
        <div style={{ position: 'fixed', top: 68, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--silver3)', boxShadow: 'var(--card-shadow)', opacity: Math.min(pullY / PULL_THRESHOLD, 1) }}>
            <span style={{ display: 'inline-block', transform: isRefreshing ? 'none' : `rotate(${Math.min(pullY / PULL_THRESHOLD, 1) * 180}deg)`, animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none', transition: 'transform 100ms' }}>↓</span>
            {isRefreshing ? 'Memperbarui...' : pullY >= PULL_THRESHOLD ? 'Lepas untuk refresh' : 'Tarik untuk refresh'}
          </div>
        </div>
      )}

      {/* Grid overlay saat dragging */}
      <div className={`drag-grid-overlay${isDraggingActive ? ' visible' : ''}`} />

      {/* Result count saat search aktif */}
      {q && (
        <div style={{
          padding: '6px 20px', fontSize: 11, color: 'var(--accent)',
          fontWeight: 600, fontFamily: 'var(--mono)',
          background: 'var(--accent-light)',
          borderBottom: '1px solid var(--accent-soft)',
        }}>
          🔍 {totalMatchItems} link ditemukan
        </div>
      )}

      {/* Shared sections */}
      {sharedAsSections.length > 0 && (
        <div className="shared-sections-row">
          {sharedAsSections.filter(section => sectionMatches(section as any)).map(section => (
            <div key={section.id}>
              <SectionCard
                section={section}
                isShared={true}
                canEdit={false}
                isMobileView={isMobile}
                onFocus={() => {}}
                onEditSection={() => {}}
                onEditItem={() => {}}
                onAddItem={() => {}}
                onDeleteSection={() => {}}
                onSave={() => {}}
                onCancel={() => {}}
              />
            </div>
          ))}
        </div>
      )}

      {/* Personal sections — draggable */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={personalSections.map(s => s.id)} strategy={rectSortingStrategy}>
          <div className="dashboard-grid">
            {personalSections.filter(section => sectionMatches(section)).map(section => (
              <div
                key={section.id}
                style={{
                  gridColumn: (expandedWidgetId === section.id && !isMobile) ? 'span 2' : undefined,
                }}
              >
                <SortableSectionCard
                  section={section}
                  editMode={editMode}
                  isMobile={isMobile}
                  searchQuery={searchQuery}
                  focusedId={focusedId}
                  onFocus={(id: string | null) => setFocusedId(prev => prev === id ? null : id)}
                  isExpanded={expandedWidgetId === section.id}
                  onExpandTodo={((section as any).widgetType === 'todo' || (section as any).widgetType === 'notes') ? () => setExpandedWidgetId(prev => prev === section.id ? null : section.id) : undefined}
                  onEditSection={handleEditSection}
                  onEditItem={handleEditItem}
                  onAddItem={handleAddItem}
                  onDeleteSection={handleDeleteSection}
                  onSave={handleSave}
                  onCancel={() => { setFocusedId(null); handleCancel() }}
                />
              </div>
            ))}
          </div>
        </SortableContext>

        {/* Drag overlay — ghost card saat drag */}
        <DragOverlay>
          {activeSection ? (
            <div style={{ opacity: 0.9, transform: 'rotate(2deg) scale(1.02)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', borderRadius: 16, overflow: 'hidden' }}>
              <SectionCard
                section={activeSection}
                isShared={false}
                canEdit={false}
                isMobileView={isMobile}
                onFocus={() => {}}
                onEditSection={() => {}}
                onEditItem={() => {}}
                onAddItem={() => {}}
                onDeleteSection={() => {}}
                onSave={() => {}}
                onCancel={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Mobile full-screen expand modal */}
      {isMobile && expandedWidgetId && (() => {
        const sec = personalSections.find(s => s.id === expandedWidgetId)
        if (!sec) return null
        const isTodo  = (sec as any).widgetType === 'todo'
        const isNotes = (sec as any).widgetType === 'notes'
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'var(--card-bg)',
            display: 'flex', flexDirection: 'column',
            animation: 'slideUp 250ms cubic-bezier(0.16,1,0.3,1)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <button onClick={() => setExpandedWidgetId(null)} style={{
                width: 34, height: 34, borderRadius: 8,
                background: 'var(--bg4)', border: '1px solid var(--border2)',
                cursor: 'pointer', color: 'var(--silver3)', fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>←</button>
              <span style={{ fontSize: 20 }}>{sec.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--silver)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sec.title}
                </div>
                {sec.subtitle && (
                  <div style={{ fontSize: 11, color: 'var(--silver3)', marginTop: 1 }}>{sec.subtitle}</div>
                )}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {isTodo  && <TodoWidget  sectionId={expandedWidgetId} />}
              {isNotes && <NotesWidget sectionId={expandedWidgetId} />}
            </div>
            {isTodo && <TodoInputFooter sectionId={expandedWidgetId} />}
          </div>
        )
      })()}
    </div>
  )
}
