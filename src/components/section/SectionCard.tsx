import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import type { Section, LinkItem, AppearanceSettings } from '../../types'
import { highlight } from '../../utils/helpers'
import AppIcon from '../ui/AppIcon'
import { sanitizeUrl } from '../../utils/security'
import { IconEdit, IconTrash, IconSettings, IconLock, IconUnlock, IconMaximize, IconMinimize } from '../ui/icons'

interface Props {
  section:              Section
  isShared?:            boolean
  canEdit?:             boolean
  isFocused?:           boolean
  isMobileView?:        boolean
  dragHandleProps?:     Record<string, unknown>
  widgetContent?:       React.ReactNode
  widgetFooter?:        React.ReactNode
  isExpanded?:          boolean                    // todo expanded state
  onExpandTodo?:        () => void                 // toggle todo expand
  onFocus?:             (id: string) => void
  onEditSection:        (s: Section) => void
  onEditItem:           (sectionId: string, item: LinkItem) => void
  onAddItem:            (sectionId: string) => void
  onDeleteSection:      (id: string) => void
  onSave?:              () => void
  onCancel?:            () => void
}

const DENSITY: Record<string, { body: string; gap: string; headerPad: string }> = {
  compact:     { body: '4px',  gap: '2px',  headerPad: '7px 12px 7px 15px'  },
  comfortable: { body: '6px',  gap: '4px',  headerPad: '9px 12px 9px 15px'  },
  spacious:    { body: '12px', gap: '8px',  headerPad: '12px 14px 12px 17px' },
}

export default memo(function SectionCard({
  section, isShared, canEdit: canEditProp,
  isFocused, isMobileView, dragHandleProps, widgetContent, widgetFooter,
  isExpanded, onExpandTodo,
  onFocus,
  onEditSection, onEditItem, onAddItem, onDeleteSection,
  onSave, onCancel,
}: Props) {
  // Granular selectors — SectionCard hanya re-render saat data relevan berubah
  const editMode      = useStore(s => s.editMode)
  const searchQuery   = useStore(s => s.searchQuery)
  // Hanya field appearance yang dipakai SectionCard
  const itemDisplayMode = useStore(s => s.appearance.itemDisplayMode)
  const folderGridCols  = useStore(s => s.appearance.folderGridCols)
  const iconSize        = useStore(s => s.appearance.iconSize)
  const faviconEnabled  = useStore(s => s.appearance.faviconEnabled)
  const isSyncing     = useStore(s => s.isSyncing)
  // Actions — via getState() untuk hindari subscription re-render
  const moveItem        = useCallback((...a: Parameters<ReturnType<typeof useStore.getState>['moveItem']>) => useStore.getState().moveItem(...a), [])
  const toggleCollapse  = useCallback((id: string) => useStore.getState().toggleCollapse(id), [])
  const deleteItem      = useCallback((...a: Parameters<ReturnType<typeof useStore.getState>['deleteItem']>) => useStore.getState().deleteItem(...a), [])
  const syncPersonalToDb = useCallback(() => useStore.getState().syncPersonalToDb(), [])

  // Build appearance object dari fields (tidak trigger re-render untuk fields lain)
  const appearance = useMemo(
    () => ({ itemDisplayMode, folderGridCols, iconSize, faviconEnabled } as AppearanceSettings),
    [itemDisplayMode, folderGridCols, iconSize, faviconEnabled]
  )
  const { profile: session } = useAuthStore()
  const canEditSection = !isShared
  const canFocus = editMode && !isShared

  // Force re-render saat notes mode toggle dari header — hanya untuk section ini
  const [, forceRender] = useState(0)
  useEffect(() => {
    const h = (e: Event) => {
      const sid = (e as CustomEvent).detail?.sectionId
      if (!sid || sid === section.id) forceRender(n => n + 1)
    }
    window.addEventListener('notes-mode-changed', h)
    return () => window.removeEventListener('notes-mode-changed', h)
  }, [section.id])

  const [confirmDel, setConfirmDel] = useState<{
    open: boolean; type: 'section' | 'item'; itemId?: string; msg: string
  }>({ open: false, type: 'section', msg: '' })

  const accent  = section.accentColor || 'var(--accent)'
  const density = DENSITY[(appearance as any).sectionDensity ?? 'compact'] || DENSITY.compact
  const isFolderGrid = appearance.itemDisplayMode === 'folderGrid'

  // item drag state
  const [itemDragOver, setItemDragOver] = useState<string | null>(null)

  const onItemDragStart = useCallback((e: React.DragEvent, item: LinkItem) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `item:${item.id}:${section.id}`)
  }, [section.id])
  const onItemDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault(); e.stopPropagation(); setItemDragOver(itemId)
  }, [])
  const onItemDrop = useCallback((e: React.DragEvent, tgtItemId: string) => {
    e.preventDefault(); e.stopPropagation(); setItemDragOver(null)
    const raw = e.dataTransfer.getData('text/plain')
    if (!raw.startsWith('item:')) return
    const [, srcItemId, srcSectionId] = raw.split(':')
    if (srcItemId === tgtItemId) return
    moveItem(srcSectionId, srcItemId, section.id, tgtItemId)
  }, [section.id, moveItem])
  const onListDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setItemDragOver(null)
    const raw = e.dataTransfer.getData('text/plain')
    if (!raw.startsWith('item:')) return
    const [, srcItemId, srcSectionId] = raw.split(':')
    moveItem(srcSectionId, srcItemId, section.id)
  }, [section.id, moveItem])

  // Stable callbacks — tidak bikin function baru setiap render
  const handleDragLeave = useCallback(() => setItemDragOver(null), [])
  const handleEditItem = useCallback((itemId: string) => {
    const item = section.items.find(i => i.id === itemId)
    if (item) onEditItem(section.id, item)
  }, [section.id, section.items, onEditItem])
  const handleDeleteItem = useCallback((itemId: string, title: string) => {
    setConfirmDel({ open: true, type: 'item', itemId, msg: `Hapus "${title}"?` })
  }, [])
  const handleAddItem = useCallback(() => onAddItem(section.id), [section.id, onAddItem])

  const q = searchQuery.toLowerCase()
  const filteredItems = useMemo(() => q
    ? section.items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.desc  && i.desc.toLowerCase().includes(q))  ||
        (i.url   && i.url.toLowerCase().includes(q))   ||
        i.tags.some(t => t.toLowerCase().includes(q))
      )
    : section.items
  , [q, section.items])

  // Item yang match via url/desc saja (bukan title) — untuk badge dot
  const urlDescMatchIds = useMemo(() => new Set(
    q ? section.items
      .filter(i =>
        !i.title.toLowerCase().includes(q) &&
        ((i.url && i.url.toLowerCase().includes(q)) ||
         (i.desc && i.desc.toLowerCase().includes(q)))
      )
      .map(i => i.id)
    : []
  ), [q, section.items])

  // Auto-expand saat ada search query yang match
  const hasMatch = q && (
    section.title.toLowerCase().includes(q) ||
    filteredItems.length > 0
  )
  const effectiveCollapsed = q ? (hasMatch ? false : section.collapsed) : section.collapsed

  // canFocus sudah didefinisikan di atas

  // Handle klik header — masuk focus edit
  const handleHeaderClick = (e: React.MouseEvent) => {
    if (!canFocus) return
    // Jangan trigger jika klik tombol
    if ((e.target as HTMLElement).closest('button')) return
    onFocus?.(section.id)
  }

  // Long press untuk drag di mobile
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleTouchStart = () => {
    if (!editMode) return
    longPressTimer.current = setTimeout(() => {
      navigator.vibrate?.(50)
    }, 500)
  }
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  return (
    <>
    <div
      className={`section-card${isFocused ? ' is-focused' : ''}${editMode && !isFocused ? ' is-blurred' : ''}`}
      style={{
        '--section-accent': accent,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        ...(isFocused ? {
          border: `1.5px solid ${accent === 'var(--accent)' ? 'var(--accent)' : accent}`,
          boxShadow: `0 0 0 3px var(--accent-soft), var(--card-shadow-hover)`,
          zIndex: 2,
        } : {}),
        transition: 'border 200ms var(--ease), box-shadow 200ms var(--ease), opacity 200ms var(--ease)',
      } as React.CSSProperties}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div
        className="section-header"
        style={{
          padding: density.headerPad,
          cursor: canFocus ? 'pointer' : 'default',
          alignItems: section.subtitle ? 'flex-start' : 'center',
          // Header highlight saat focused
          ...(isFocused ? { background: 'var(--accent-light)' } : {}),
        }}
        onClick={handleHeaderClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — tampil saat edit mode, pakai dnd-kit listeners */}
        {editMode && dragHandleProps && (
          <div
            className="drag-handle"
            {...dragHandleProps as any}
            title="Seret untuk pindah"
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
              <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
              <circle cx="2" cy="7" r="1.5"/><circle cx="8" cy="7" r="1.5"/>
              <circle cx="2" cy="12" r="1.5"/><circle cx="8" cy="12" r="1.5"/>
            </svg>
          </div>
        )}

        <span className="section-icon" style={{ marginTop: section.subtitle ? 1 : 0 }}>
          {section.icon || '📁'}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="section-title">{section.title}</div>
            {/* Badge item count untuk section biasa */}
            {section.type !== 'widget' && section.items.length > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
                background: 'var(--bg4)', color: 'var(--silver3)',
                fontFamily: 'var(--mono)', border: '1px solid var(--border)',
              }}>{section.items.length}</span>
            )}
          </div>
          {section.subtitle && (
            <div style={{
              fontSize: 11, color: 'var(--silver3)', fontWeight: 400,
              marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {section.subtitle}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          {/* Focus tools — muncul saat section focused, hapus favourite */}
          {isFocused && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Edit section */}
              <button
                className="sec-action-btn-lg"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onEditSection(section) }}
                title="Edit Section"
              ><IconSettings /></button>
              {/* Hapus section */}
              <button
                className="sec-action-btn-lg danger"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation()
                  setConfirmDel({ open: true, type: 'section',
                    msg: `Hapus section "${section.title}" beserta semua item di dalamnya?` })
                }}
                title="Hapus Section"
              ><IconTrash /></button>
            </div>
          )}

          {/* Expand button — todo & notes */}
          {((section as any).widgetType === 'notes' || (section as any).widgetType === 'calendar') && onExpandTodo && !editMode && (
            <button
              className="sec-action-btn-lg"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onExpandTodo() }}
              title={isExpanded ? "Kecilkan" : "Perbesar"}
              style={{ fontSize: 11 }}
            >{isExpanded ? <IconMinimize /> : <IconMaximize />}</button>
          )}

          {/* Notes lock toggle in header */}
          {(section as any).widgetType === 'notes' && !editMode && session?.username && (() => {
            const mk = `notes-mode-${session.username}-${section.id}`
            const lk = `notes-locked-${session.username}-${section.id}`
            const mode = localStorage.getItem(mk) ?? 'open'
            const isLocked = localStorage.getItem(lk) === 'true'

            const handleGembok = (e: React.MouseEvent) => {
              e.stopPropagation()
              const ev = new CustomEvent('notes-mode-changed', { detail: { sectionId: section.id } })
              if (mode === 'open') {
                localStorage.setItem(mk, 'lock')
                localStorage.setItem(lk, 'true')
                window.dispatchEvent(ev)
              } else if (mode === 'lock' && !isLocked) {
                localStorage.setItem(lk, 'true')
                sessionStorage.removeItem(`notes-session-${session.username}-${section.id}`)
                window.dispatchEvent(ev)
              } else if (mode === 'lock' && isLocked) {
                // Locked → tell widget to show PIN dialog
                window.dispatchEvent(new CustomEvent('notes-request-unlock', { detail: { sectionId: section.id } }))
              }
            }

            return (
              <button onClick={handleGembok} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, padding: '2px 4px', borderRadius: 4,
              }} title={
                mode === 'open' ? 'Kunci catatan' :
                !isLocked ? 'Kunci kembali' : 'Terkunci — buka di dalam widget'
              }>
                {mode === 'lock' ? <IconLock /> : <IconUnlock />}
              </button>
            )
          })()}

          {/* Collapse button — selalu ada */}
          <button
            className={`sec-collapse-btn${section.collapsed ? '' : ' open'}`}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); toggleCollapse(section.id) }}
            title={section.collapsed ? "Buka Section" : "Tutup Section"}
            aria-label={section.collapsed ? "Buka Section" : "Tutup Section"}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div className={`section-body${effectiveCollapsed ? ' collapsed' : ''}${isExpanded ? ' expanded' : ''}`}>
        {/* Empty state */}
        {!widgetContent && filteredItems.length === 0 && !editMode && (
          <div className="section-empty">
            <span className="section-empty-icon">🔗</span>
            <span className="section-empty-text">Belum ada link</span>
          </div>
        )}
        {/* Widget content override */}
        {widgetContent ? widgetContent : (isFolderGrid ? (
          <div
            className="folder-grid"
            style={{ '--folder-cols': 5 } as React.CSSProperties}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              const raw = e.dataTransfer.getData('text/plain')
              if (!raw.startsWith('item:')) return
              const [, srcItemId, srcSectionId] = raw.split(':')
              moveItem(srcSectionId, srcItemId, section.id)
            }}
          >
            {filteredItems.map(item => (
              <FolderItem
                key={item.id}
                item={item}
                searchQuery={q}
                urlDescMatch={urlDescMatchIds.has(item.id)}
                editMode={editMode}
                dragOver={itemDragOver === item.id}
                appearance={appearance}
                onDragStart={onItemDragStart}
                onDragOver={onItemDragOver}
                onDrop={onItemDrop}
                onDragLeave={handleDragLeave}
                onEdit={handleEditItem}
                onDelete={handleDeleteItem}
              />
            ))}
            {/* Ghost add item — saat section focused (desktop edit mode) */}
            {isFocused && canEditSection && editMode && (
              <GhostAddItem onClick={handleAddItem} />
            )}
            {/* Mobile: tombol tambah link selalu tampil untuk personal section */}
            {isMobileView && !isShared && !editMode && (
              <div
                onClick={handleAddItem}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 2, cursor: 'pointer', padding: '8px 4px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1.5px dashed var(--border2)',
                  color: 'var(--silver3)', fontSize: 18,
                  minHeight: 48,
                  transition: 'border-color 150ms, color 150ms',
                }}
              >
                <span>＋</span>
                <span style={{ fontSize: 9, fontWeight: 600 }}>Tambah</span>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{ padding: density.body, display: 'flex', flexDirection: 'column', gap: density.gap }}
            onDragOver={e => e.preventDefault()}
            onDrop={onListDrop}
          >
            {filteredItems.map(item => (
              <ListItem
                key={item.id}
                item={item}
                searchQuery={q}
                urlDescMatch={urlDescMatchIds.has(item.id)}
                editMode={editMode}
                appearance={appearance}
                onEdit={handleEditItem}
                onDelete={handleDeleteItem}
              />
            ))}
            {!!isFocused && canEditSection && editMode && (
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); handleAddItem() }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, height: 36, width: '100%',
                  background: 'var(--accent-light)',
                  border: '1px dashed var(--border2)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--accent)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font)',
                }}>
                ＋ Tambah Link
              </button>
            )}
            {/* Mobile: tombol tambah link selalu tampil untuk personal section */}
            {isMobileView && !isShared && !editMode && (
              <button
                onClick={handleAddItem}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, height: 36, width: '100%',
                  background: 'none',
                  border: '1.5px dashed var(--border2)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--silver3)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font)',
                }}>
                ＋ Tambah Link
              </button>
            )}
          </div>
        ))}
      </div>
      {isFocused && canEditSection && (
        <div style={{
          display: 'flex', gap: 8, padding: '10px 12px',
          borderTop: '1px solid var(--border)',
          background: 'var(--accent-light)',
          flexShrink: 0,
        }}>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onCancel?.() }}
            style={{
              flex: 1, height: 36, background: 'none',
              border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
              color: 'var(--silver3)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font)',
            }}>Batal</button>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={async e => {
              e.stopPropagation()
              // Tunggu sync selesai dulu
              await syncPersonalToDb()
              onSave?.()
            }}
            disabled={isSyncing}
            style={{
              flex: 2, height: 36,
              background: 'var(--accent)', border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'white', fontSize: 12, fontWeight: 700,
              cursor: isSyncing ? 'wait' : 'pointer', fontFamily: 'var(--font)',
              opacity: isSyncing ? 0.7 : 1,
            }}>{isSyncing ? '⏳ Menyimpan...' : '✓ Simpan'}</button>
        </div>
      )}
    </div>

    {/* Widget footer — fix di bawah, tidak ikut scroll */}
    {widgetFooter && !effectiveCollapsed && widgetFooter}

    {/* Confirm dialog */}
    <ConfirmDialog
      open={confirmDel.open}
      title={confirmDel.type === 'section' ? 'Hapus Section' : 'Hapus Link'}
      message={confirmDel.msg}
      danger={true}
      onConfirm={() => {
        if (confirmDel.type === 'section') {
          onDeleteSection(section.id)
        } else if (confirmDel.type === 'item' && confirmDel.itemId) {
          deleteItem(section.id, confirmDel.itemId)
          useStore.getState().toast('Link dihapus.', 'success')
        }
        setConfirmDel({ open: false, type: 'section', msg: '' })
      }}
      onCancel={() => setConfirmDel({ open: false, type: 'section', msg: '' })}
    />
    </>
  )
})

// ── Ghost add item ────────────────────────────────────────
function GhostAddItem({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onTouchStart={() => setHov(true)}
      onTouchEnd={e => { e.preventDefault(); setHov(false); onClick() }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 4, cursor: 'pointer',
        borderRadius: 'var(--radius-sm)',
        minHeight: 'var(--touch-ideal, 48px)',
        border: `1.5px dashed ${hov ? 'var(--accent)' : 'var(--border2)'}`,
        background: hov ? 'var(--accent-light)' : 'transparent',
        transition: 'all 150ms var(--ease)',
        color: hov ? 'var(--accent)' : 'var(--silver3)',
      }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>＋</span>
      <span style={{ fontSize: 10, fontWeight: 600 }}>Tambah</span>
    </div>
  )
}

// ── Folder Item ───────────────────────────────────────────
interface FolderItemProps {
  item:        LinkItem
  searchQuery: string
  editMode:    boolean
  dragOver:    boolean
  appearance:  AppearanceSettings
  onDragStart: (e: React.DragEvent, item: LinkItem) => void
  onDragOver:  (e: React.DragEvent, id: string) => void
  onDrop:      (e: React.DragEvent, id: string) => void
  onDragLeave: () => void
  onEdit:      (itemId: string) => void
  onDelete:    (itemId: string, title: string) => void
}

const FolderItem = memo(function FolderItem({ item, searchQuery, urlDescMatch, editMode, dragOver, appearance, onDragStart, onDragOver, onDrop, onDragLeave, onEdit, onDelete }: FolderItemProps & { urlDescMatch?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const [tipPos, setTipPos]   = useState({ x: 0, y: 0 })

  const handleItemClick = (item: LinkItem, editMode: boolean) => {
    if (editMode) return
    const url = sanitizeUrl(item.url)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const showLabel = true

  // Tooltip konteks match
  const matchContext = urlDescMatch && searchQuery
    ? (item.url?.toLowerCase().includes(searchQuery) ? `🔗 ${item.url}` : item.desc ?? '')
    : ''

  return (
    <div
      className={`folder-item${dragOver ? ' drag-over' : ''}`}
      style={{
        opacity: dragOver ? 0.5 : 1,
        outline: hovered && !editMode ? '2px solid var(--border2)' : 'none',
        outlineOffset: '-2px',
        userSelect: 'none',
      }}
      draggable={editMode}
      onDragStart={e => onDragStart(e, item)}
      onDragOver={e => onDragOver(e, item.id)}
      onDrop={e => onDrop(e, item.id)}
      onDragLeave={onDragLeave}
      onClick={() => handleItemClick(item, editMode)}
      onMouseEnter={e => {
        setHovered(true)
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        // Clamp ke viewport - tooltip max width 240
        const x = Math.max(130, Math.min(window.innerWidth - 130, r.left + r.width / 2))
        const y = r.top < 50 ? r.bottom + 8 : r.top  // di bawah jika dekat top edge
        setTipPos({ x, y })
      }}
      onMouseLeave={() => setHovered(false)}
      aria-label={item.title}
      title={matchContext || undefined}
    >
      {/* Icon wrapper dengan badge dot saat url/desc match */}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <AppIcon item={item} iconSize={appearance.iconSize} faviconEnabled={appearance.faviconEnabled} />
        {urlDescMatch && searchQuery && (
          <span style={{
            position: 'absolute', top: -3, right: -3,
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)',
            border: '1.5px solid var(--card-bg)',
            boxShadow: '0 0 4px var(--accent)',
          }} />
        )}
        {/* Tooltip via portal — bypass overflow:hidden dan transform parent */}
        {item.desc && hovered && !editMode && createPortal(
          <div style={{
            position: 'fixed',
            left: tipPos.x,
            top: tipPos.y - 8,
            transform: 'translate(-50%, -100%)',
            background: 'var(--bg2)',
            border: '1px solid var(--border2)',
            borderRadius: 7, padding: '5px 10px',
            zIndex: 99999, pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap', maxWidth: 240,
            fontSize: 11, color: 'var(--silver2)', lineHeight: 1.4,
            animation: 'fadeIn 120ms ease',
          }}>
            {item.desc}
            <div style={{
              position: 'absolute', bottom: -4, left: '50%',
              width: 8, height: 8,
              background: 'var(--bg2)',
              border: '1px solid var(--border2)',
              borderTop: 'none', borderLeft: 'none',
              transform: 'translateX(-50%) rotate(45deg)',
            }} />
          </div>,
          document.body
        )}
      </div>

      {showLabel && (
        <div style={{
          fontSize: 11, color: 'var(--silver)', textAlign: 'center',
          lineHeight: 1.3, width: '100%',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          wordBreak: 'break-word',
        }}
          dangerouslySetInnerHTML={{ __html: highlight(item.title, searchQuery) }}
        />
      )}

      {/* Action buttons — selalu visible saat editMode (section focused) */}
      {editMode && (
        <div
          className="folder-action-group"
          onMouseDown={e => e.stopPropagation()}
          style={{ opacity: 1 }}
        >
          <button className="folder-edit-btn" onClick={e => { e.stopPropagation(); onEdit(item.id) }} title="Edit item" aria-label="Edit item"><IconEdit size={10} /></button>
          <button className="folder-delete-btn" onClick={e => { e.stopPropagation(); onDelete(item.id, item.title) }} title="Hapus item" aria-label="Hapus item"><IconTrash size={10} /></button>
        </div>
      )}
    </div>
  )
})

// ── List Item ─────────────────────────────────────────────
interface ListItemProps {
  item:        LinkItem
  searchQuery: string
  editMode:    boolean
  appearance:  AppearanceSettings
  onEdit:      (itemId: string) => void
  onDelete:    (itemId: string, title: string) => void
}

const ListItem = memo(function ListItem({ item, searchQuery, urlDescMatch, editMode, appearance, onEdit, onDelete }: ListItemProps & { urlDescMatch?: boolean }) {
  const handleClick = () => {
    if (editMode) return
    const url = sanitizeUrl(item.url)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const matchContext = urlDescMatch && searchQuery
    ? (item.url?.toLowerCase().includes(searchQuery) ? item.url : item.desc ?? '')
    : ''

  return (
    <div className="item-card" onClick={handleClick} title={item.title}>
      <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
        <AppIcon item={item} iconSize="small" faviconEnabled={appearance.faviconEnabled} />
        {urlDescMatch && searchQuery && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--accent)',
            border: '1.5px solid var(--card-bg)',
          }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="item-title"
          dangerouslySetInnerHTML={{ __html: highlight(item.title, searchQuery) }} />
        {urlDescMatch && searchQuery && (
          <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {matchContext.slice(0, 60)}
          </div>
        )}
      </div>
      {editMode && (
        <div className="item-action-group" style={{ opacity: 1 }} onMouseDown={e => e.stopPropagation()}>
          <button className="item-edit-btn" onClick={e => { e.stopPropagation(); onEdit(item.id) }} title="Edit" aria-label="Edit"><IconEdit size={11} /></button>
          <button className="item-delete-btn" onClick={e => { e.stopPropagation(); onDelete(item.id, item.title) }} title="Hapus" aria-label="Hapus"><IconTrash size={11} /></button>
        </div>
      )}
    </div>
  )
})
