import { useState, useRef, memo, useCallback } from 'react'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import type { Section, LinkItem, AppearanceSettings } from '../../types'
import { highlight } from '../../utils/helpers'
import AppIcon from '../ui/AppIcon'
import { sanitizeUrl } from '../../utils/security'

interface Props {
  section: Section
  isShared?: boolean
  canEdit?: boolean
  isFocused?: boolean           // section sedang dalam focus edit
  onFocus?: (id: string) => void  // callback saat header diklik
  onEditSection: (s: Section) => void
  onEditItem: (sectionId: string, item: LinkItem) => void
  onAddItem: (sectionId: string) => void
  onDeleteSection: (id: string) => void
  onSave?: () => void        // callback setelah simpan
  onCancel?: () => void        // callback batal
}

const DENSITY: Record<string, { body: string; gap: string; headerPad: string }> = {
  compact: { body: '4px', gap: '2px', headerPad: '7px 12px 7px 15px' },
  comfortable: { body: '6px', gap: '4px', headerPad: '9px 12px 9px 15px' },
  spacious: { body: '12px', gap: '8px', headerPad: '12px 14px 12px 17px' },
}

export default memo(function SectionCard({
  section, isShared, canEdit: canEditProp,
  isFocused, onFocus,
  onEditSection, onEditItem, onAddItem, onDeleteSection,
  onSave, onCancel,
}: Props) {
  // Granular selectors — SectionCard hanya re-render saat data relevan berubah
  const editMode = useStore(s => s.editMode)
  const searchQuery = useStore(s => s.searchQuery)
  // Hanya field appearance yang dipakai SectionCard
  const itemDisplayMode = useStore(s => s.appearance.itemDisplayMode)
  const folderGridCols = useStore(s => s.appearance.folderGridCols)
  const iconSize = useStore(s => s.appearance.iconSize)
  const faviconEnabled = useStore(s => s.appearance.faviconEnabled)
  const isSyncing = useStore(s => s.isSyncing)
  const { moveItem, toggleCollapse, deleteItem, toast, syncPersonalToDb } = useStore()

  // Build appearance object dari fields (tidak trigger re-render untuk fields lain)
  const appearance = { itemDisplayMode, folderGridCols, iconSize, faviconEnabled } as AppearanceSettings
  const { profile: session } = useAuthStore()
  const isAdmin = isShared ? false : true
  const canFocus = editMode && !isShared  // semua user bisa edit section pribadi

  const [confirmDel, setConfirmDel] = useState<{
    open: boolean; type: 'section' | 'item'; itemId?: string; msg: string
  }>({ open: false, type: 'section', msg: '' })

  const accent = section.accentColor || 'var(--accent)'
  const density = DENSITY[(appearance as any).sectionDensity ?? 'compact'] || DENSITY.compact
  const isFolderGrid = appearance.itemDisplayMode === 'folderGrid'

  // item drag state
  const [itemDragOver, setItemDragOver] = useState<string | null>(null)

  const onItemDragStart = (e: React.DragEvent, item: LinkItem) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `item:${item.id}:${section.id}`)
  }
  const onItemDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault(); e.stopPropagation(); setItemDragOver(itemId)
  }
  const onItemDrop = (e: React.DragEvent, tgtItemId: string) => {
    e.preventDefault(); e.stopPropagation(); setItemDragOver(null)
    const raw = e.dataTransfer.getData('text/plain')
    if (!raw.startsWith('item:')) return
    const [, srcItemId, srcSectionId] = raw.split(':')
    if (srcItemId === tgtItemId) return
    // Pass tgtItemId agar item diinsert di posisi yang benar
    moveItem(srcSectionId, srcItemId, section.id, tgtItemId)
  }
  const onListDrop = (e: React.DragEvent) => {
    e.preventDefault(); setItemDragOver(null)
    const raw = e.dataTransfer.getData('text/plain')
    if (!raw.startsWith('item:')) return
    const [, srcItemId, srcSectionId] = raw.split(':')
    moveItem(srcSectionId, srcItemId, section.id)
  }

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
  const filteredItems = q
    ? section.items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      (i.desc && i.desc.toLowerCase().includes(q)) ||
      i.tags.some(t => t.toLowerCase().includes(q))
    )
    : section.items

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
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          ...(isFocused ? {
            border: `1.5px solid ${accent === 'var(--accent)' ? 'var(--accent)' : accent}`,
            boxShadow: `0 0 0 3px var(--mint-bg2), var(--shadow)`,
            position: 'relative', zIndex: 2,
          } : {}),
          transition: 'border 200ms var(--ease), box-shadow 200ms var(--ease), opacity 200ms var(--ease), filter 200ms var(--ease)',
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
            ...(isFocused ? { background: 'var(--mint-bg)' } : {}),
          }}
          onClick={handleHeaderClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag handle — hanya tampil saat edit mode, tidak focused */}
          {editMode && !isFocused && (
            <div className="drag-handle" style={{
              cursor: 'grab', padding: '0 6px', color: 'var(--silver3)',
              fontSize: 12, display: 'flex', alignItems: 'center',
              flexShrink: 0, userSelect: 'none',
            }}>⠿</div>
          )}

          <span className="section-icon" style={{ marginTop: section.subtitle ? 1 : 0 }}>
            {section.icon || '📁'}
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="section-title">{section.title}</div>
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
                >⚙️</button>
                {/* Hapus section */}
                <button
                  className="sec-action-btn-lg danger"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation()
                    setConfirmDel({
                      open: true, type: 'section',
                      msg: `Hapus section "${section.title}" beserta semua item di dalamnya?`
                    })
                  }}
                  title="Hapus Section"
                >🗑</button>
              </div>
            )}

            {/* Collapse button — selalu ada */}
            <button
              className={`sec-collapse-btn${section.collapsed ? '' : ' open'}`}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); toggleCollapse(section.id) }}
              title={section.collapsed ? "Buka Section" : "Tutup Section"}
              aria-label={section.collapsed ? "Buka Section" : "Tutup Section"}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className={`section-body${section.collapsed ? ' collapsed' : ''}`}>
          {isFolderGrid ? (
            <div
              className="folder-grid"
              style={{ '--folder-cols': appearance.folderGridCols } as React.CSSProperties}
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
                  editMode={!!isFocused && isAdmin && editMode}
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
              {/* Ghost add item — saat section focused */}
              {isFocused && isAdmin && editMode && (
                <GhostAddItem onClick={handleAddItem} />
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
                  editMode={!!isFocused && isAdmin && editMode}
                  appearance={appearance}
                  onEdit={handleEditItem}
                  onDelete={handleDeleteItem}
                />
              ))}
              {/* Poin 12: tombol tambah link di list view saat focused */}
              {!!isFocused && isAdmin && editMode && (
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); handleAddItem() }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 6, height: 36, width: '100%',
                    background: 'var(--mint-bg)',
                    border: '1px dashed var(--border2)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--accent)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font)',
                  }}>
                  ＋ Tambah Link
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Footer: Simpan + Batal — hanya saat focused ─── */}
        {isFocused && isAdmin && (
          <div style={{
            display: 'flex', gap: 8, padding: '10px 12px',
            borderTop: '1px solid var(--border)',
            background: 'var(--mint-bg)',
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
            toast('Link dihapus.', 'success')
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
        background: hov ? 'var(--mint-bg)' : 'transparent',
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
  item: LinkItem
  searchQuery: string
  editMode: boolean
  dragOver: boolean
  appearance: AppearanceSettings
  onDragStart: (e: React.DragEvent, item: LinkItem) => void
  onDragOver: (e: React.DragEvent, id: string) => void
  onDrop: (e: React.DragEvent, id: string) => void
  onDragLeave: () => void
  onEdit: (itemId: string) => void
  onDelete: (itemId: string, title: string) => void
}

function FolderItem({ item, searchQuery, editMode, dragOver, appearance, onDragStart, onDragOver, onDrop, onDragLeave, onEdit, onDelete }: FolderItemProps) {
  const [hovered, setHovered] = useState(false)

  const handleItemClick = (item: LinkItem, editMode: boolean) => {
    if (editMode) return
    const url = sanitizeUrl(item.url)
    if (url) window.open(url, item.newTab ? '_blank' : '_self', 'noopener,noreferrer')
  }

  const showLabel = true  // poin 13: default semua berlabel

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={item.title}
    >
      <AppIcon item={item} iconSize={appearance.iconSize} faviconEnabled={appearance.faviconEnabled} />

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
          <button className="folder-edit-btn" onClick={e => { e.stopPropagation(); onEdit(item.id) }} title="Edit item" aria-label="Edit item">✏️</button>
          <button className="folder-delete-btn" onClick={e => { e.stopPropagation(); onDelete(item.id, item.title) }} title="Hapus item" aria-label="Hapus item">🗑</button>
        </div>
      )}
    </div>
  )
}

// ── List Item ─────────────────────────────────────────────
interface ListItemProps {
  item: LinkItem
  searchQuery: string
  editMode: boolean
  appearance: AppearanceSettings
  onEdit: (itemId: string) => void
  onDelete: (itemId: string, title: string) => void
}

function ListItem({ item, searchQuery, editMode, appearance, onEdit, onDelete }: ListItemProps) {
  const handleClick = () => {
    if (editMode) return
    const url = sanitizeUrl(item.url)
    if (url) window.open(url, item.newTab ? '_blank' : '_self', 'noopener,noreferrer')
  }

  return (
    <div className="item-card" onClick={handleClick}>
      <AppIcon item={item} iconSize="small" faviconEnabled={appearance.faviconEnabled} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="item-title"
          dangerouslySetInnerHTML={{ __html: highlight(item.title, searchQuery) }} />
      </div>
      {editMode && (
        <div className="item-action-group" style={{ opacity: 1 }} onMouseDown={e => e.stopPropagation()}>
          <button className="item-edit-btn" onClick={e => { e.stopPropagation(); onEdit(item.id) }}>✏️</button>
          <button className="item-delete-btn" onClick={e => { e.stopPropagation(); onDelete(item.id, item.title) }}>🗑</button>
        </div>
      )}
    </div>
  )
}
