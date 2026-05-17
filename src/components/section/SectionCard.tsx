import { useState, useRef } from 'react'
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
  onToggleFavorite?: (sectionId: string) => void
  onToggleFavoriteItem?: (sectionId: string, itemId: string) => void
  onSave?: () => void        // callback setelah simpan
  onCancel?: () => void        // callback batal
}

const DENSITY: Record<string, { body: string; gap: string; headerPad: string }> = {
  compact: { body: '4px', gap: '2px', headerPad: '7px 12px 7px 15px' },
  comfortable: { body: '6px', gap: '4px', headerPad: '9px 12px 9px 15px' },
  spacious: { body: '12px', gap: '8px', headerPad: '12px 14px 12px 17px' },
}

export default function SectionCard({
  section, isShared, canEdit: canEditProp,
  isFocused, onFocus,
  onEditSection, onEditItem, onAddItem, onDeleteSection,
  onToggleFavorite, onToggleFavoriteItem,
  onSave, onCancel,
}: Props) {
  const { editMode, searchQuery, moveItem, toggleCollapse, appearance, displayOptions, deleteItem, toast, syncPersonalToDb, isSyncing } = useStore()
  const { profile: session } = useAuthStore()
  const isAdmin = isShared ? false : true

  const [confirmDel, setConfirmDel] = useState<{
    open: boolean; type: 'section' | 'item' | 'unfavorite'; itemId?: string; msg: string
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
    moveItem(srcSectionId, srcItemId, section.id)
  }
  const onListDrop = (e: React.DragEvent) => {
    e.preventDefault(); setItemDragOver(null)
    const raw = e.dataTransfer.getData('text/plain')
    if (!raw.startsWith('item:')) return
    const [, srcItemId, srcSectionId] = raw.split(':')
    moveItem(srcSectionId, srcItemId, section.id)
  }

  const q = searchQuery.toLowerCase()
  const filteredItems = q
    ? section.items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      (i.desc && i.desc.toLowerCase().includes(q)) ||
      i.tags.some(t => t.toLowerCase().includes(q))
    )
    : section.items

  // Apakah section ini benar-benar editable
  const canFocus = isAdmin && editMode && !isShared

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
        className="section-card"
        style={{
          '--section-accent': accent,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          // Focus highlight
          ...(isFocused ? {
            border: `1.5px solid ${accent === 'var(--accent)' ? 'var(--accent)' : accent}`,
            boxShadow: `0 0 0 3px var(--mint-bg2), var(--shadow)`,
          } : {}),
          transition: 'border 200ms var(--ease), box-shadow 200ms var(--ease)',
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
          <span className="section-icon" style={{ marginTop: section.subtitle ? 1 : 0 }}>
            {section.icon || '📁'}
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="section-title">{section.title}</div>
            {section.subtitle && (
              <div style={{
                fontSize: 10, color: 'var(--silver3)', fontWeight: 400,
                letterSpacing: '.2px', marginTop: 1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {section.subtitle}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            {/* Focus tools — muncul saat section focused */}
            {isFocused && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {/* Favorite */}
                {!isShared && onToggleFavorite && (
                  <button
                    className="sec-action-btn-lg"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation()
                      if (section.isFavorite) {
                        setConfirmDel({
                          open: true, type: 'unfavorite',
                          msg: `Lepas "${section.title}" dari Favorit?`
                        })
                      } else {
                        onToggleFavorite(section.id)
                      }
                    }}
                    title={section.isFavorite ? 'Lepas favorit' : 'Tandai favorit'}
                    style={{ color: section.isFavorite ? '#FFD700' : undefined }}
                  >⭐</button>
                )}
                {/* Tambah link */}
                <button
                  className="sec-action-btn-lg"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); onAddItem(section.id) }}
                  title="Tambah Link"
                  style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                >＋</button>
                {/* Edit section (buka modal) */}
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
                  onDragLeave={() => setItemDragOver(null)}
                  onEdit={() => onEditItem(section.id, item)}
                  onDelete={() => setConfirmDel({ open: true, type: 'item', itemId: item.id, msg: `Hapus "${item.title}"?` })}
                />
              ))}
              {/* Ghost add item — saat section focused */}
              {isFocused && isAdmin && editMode && (
                <GhostAddItem onClick={() => onAddItem(section.id)} />
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
                  showDesc={displayOptions.showDesc}
                  showTags={displayOptions.showTags}
                  onEdit={() => onEditItem(section.id, item)}
                  onDelete={() => setConfirmDel({ open: true, type: 'item', itemId: item.id, msg: `Hapus "${item.title}"?` })}
                />
              ))}
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
        title={confirmDel.type === 'section' ? 'Hapus Section' : confirmDel.type === 'unfavorite' ? 'Lepas Favorit' : 'Hapus Link'}
        message={confirmDel.msg}
        danger={confirmDel.type !== 'unfavorite'}
        onConfirm={() => {
          if (confirmDel.type === 'unfavorite') {
            onToggleFavorite?.(section.id)
          } else if (confirmDel.type === 'section') {
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
}

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
  onEdit: () => void
  onDelete: () => void
}

function FolderItem({ item, searchQuery, editMode, dragOver, appearance, onDragStart, onDragOver, onDrop, onDragLeave, onEdit, onDelete }: FolderItemProps) {
  const [hovered, setHovered] = useState(false)

  const handleItemClick = (item: LinkItem, editMode: boolean) => {
    if (editMode) return
    const url = sanitizeUrl(item.url)
    if (url) window.open(url, item.newTab ? '_blank' : '_self', 'noopener,noreferrer')
  }

  const showLabel = appearance.labelMode !== 'hide' || editMode

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
          <button className="folder-edit-btn" onClick={e => { e.stopPropagation(); onEdit() }} title="Edit">✏️</button>
          <button className="folder-delete-btn" onClick={e => { e.stopPropagation(); onDelete() }} title="Hapus">🗑</button>
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
  showDesc: boolean
  showTags: boolean
  onEdit: () => void
  onDelete: () => void
}

function ListItem({ item, searchQuery, editMode, appearance, showDesc, showTags, onEdit, onDelete }: ListItemProps) {
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
        {showDesc && item.desc && <div className="item-desc">{item.desc}</div>}
        {showTags && item.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
            {item.tags.map(t => (
              <span key={t} style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 3,
                background: 'var(--mint-bg)', color: 'var(--accent)',
                fontFamily: 'var(--mono)', fontWeight: 700,
              }}>{t}</span>
            ))}
          </div>
        )}
      </div>
      {editMode && (
        <div className="item-action-group" style={{ opacity: 1 }} onMouseDown={e => e.stopPropagation()}>
          <button className="item-edit-btn" onClick={e => { e.stopPropagation(); onEdit() }}>✏️</button>
          <button className="item-delete-btn" onClick={e => { e.stopPropagation(); onDelete() }}>🗑</button>
        </div>
      )}
    </div>
  )
}
