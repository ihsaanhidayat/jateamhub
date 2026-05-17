import { useState } from 'react'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import type { Section, LinkItem, AppearanceSettings } from '../../types'
import { highlight } from '../../utils/helpers'
import AppIcon from '../ui/AppIcon'
import { sanitizeUrl } from '../../utils/security'

interface Props {
  section:              Section
  isShared?:            boolean
  canEdit?:             boolean
  onEditSection:        (s: Section) => void
  onEditItem:           (sectionId: string, item: LinkItem) => void
  onAddItem:            (sectionId: string) => void
  onDeleteSection:      (id: string) => void
  onToggleFavorite?:    (sectionId: string) => void        // toggle favorite section
  onToggleFavoriteItem?:(sectionId: string, itemId: string) => void // toggle favorite item
}

const DENSITY: Record<string, { body: string; gap: string; headerPad: string }> = {
  compact:     { body: '4px',  gap: '2px',  headerPad: '7px 12px 7px 15px'  },
  comfortable: { body: '6px',  gap: '4px',  headerPad: '9px 12px 9px 15px'  },
  spacious:    { body: '12px', gap: '8px',  headerPad: '12px 14px 12px 17px' },
}

export default function SectionCard({ section, isShared, canEdit: canEditProp, onEditSection, onEditItem, onAddItem, onDeleteSection, onToggleFavorite, onToggleFavoriteItem }: Props) {
  const { editMode, searchQuery, moveItem, toggleCollapse, appearance, displayOptions, deleteItem, toast } = useStore()
  const { profile: session } = useAuthStore()
  // Semua user bisa edit section pribadi mereka sendiri
  // Shared section tetap read-only
  // isAdmin = bisa edit section ini
  // isShared = false berarti section pribadi, semua user boleh edit
  // isShared = true berarti dari admin, tidak boleh diedit siapapun
  const isAdmin = isShared ? false : true
  const [headerHovered, setHeaderHovered] = useState(false)
  const [confirmDel, setConfirmDel] = useState<{ open: boolean; type: 'section' | 'item' | 'unfavorite'; itemId?: string; msg: string }>({ open: false, type: 'section', msg: '' })
  const accent   = section.accentColor || 'var(--mint)'
  const density  = DENSITY[(appearance as any).sectionDensity ?? 'compact'] || DENSITY.compact
  const isFolderGrid = appearance.itemDisplayMode === 'folderGrid'

  // item drag state (native HTML DnD — tidak konflik dengan RGL)
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

  return (
    <>
    <div
      className="section-card"
      style={{
        '--section-accent': accent,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      } as React.CSSProperties}
    >

      {/* ── Header ─────────────────────────────────────── */}
      {/* section-header jadi drag handle untuk RGL (via draggableHandle) */}
      <div
        className="section-header"
        style={{
          padding: density.headerPad,
          cursor: isAdmin && editMode ? 'grab' : 'default',
          alignItems: section.subtitle ? 'flex-start' : 'center',
        }}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
      >
        <span className="section-icon" style={{ marginTop: section.subtitle ? 1 : 0 }}>{section.icon || '📁'}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="section-title">{section.title}</div>
          {section.subtitle && (
            <div style={{
              fontSize: 10,
              color: 'var(--silver3)',
              fontWeight: 400,
              letterSpacing: '.2px',
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {section.subtitle}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          {/* Focus edit mode — tombol muncul saat hover header */}
          {isAdmin && editMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Tombol favorite section — hanya untuk OWN section */}
              {!isShared && onToggleFavorite && (
                <button
                  className="sec-action-btn-lg"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation()
                    if (section.isFavorite) {
                      // Warning saat melepas favorite
                      setConfirmDel({
                        open: true,
                        type: 'unfavorite',
                        msg: `Lepas "${section.title}" dari Favorit? Section tidak akan lagi tampil di urutan pertama.`,
                      })
                    } else {
                      onToggleFavorite(section.id)
                    }
                  }}
                  title={section.isFavorite ? 'Lepas dari favorit' : 'Tandai sebagai favorit'}
                  style={{ color: section.isFavorite ? '#FFD700' : undefined }}
                >⭐</button>
              )}
              <button
                className="sec-action-btn-lg"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onEditSection(section) }}
                title="Edit section"
              >✏️</button>
              <button
                className="sec-action-btn-lg danger"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => {
                  e.stopPropagation()
                  setConfirmDel({ open: true, type: 'section', msg: `Hapus section "${section.title}" beserta semua item di dalamnya?` })
                  // panggil onDeleteSection dari parent saat konfirmasi
                }}
                title="Hapus section"
              >🗑</button>
            </div>
          )}
          <button
            className={`sec-collapse-btn${section.collapsed ? '' : ' open'}`}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); toggleCollapse(section.id) }}
            title={section.collapsed ? 'Expand' : 'Collapse'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────── */}
      <div
        className={`section-body${section.collapsed ? ' collapsed' : ''}`}
        style={{ flex: 1, overflow: 'auto' }}
      >
        {isFolderGrid ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${appearance.folderGridCols}, 1fr)`,
              gap: density.gap === '2px' ? '8px' : density.gap === '4px' ? '12px' : '16px',
              padding: density.body === '4px' ? '8px' : density.body === '6px' ? '10px' : '14px',
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={onListDrop}
          >
            {filteredItems.map(item => (
              <FolderItem
                key={item.id}
                item={item}
                searchQuery={q}
                editMode={isAdmin && editMode}
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
            {/* Ghost + item — muncul saat edit mode, setelah icon terakhir */}
            {isAdmin && editMode && (
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
                editMode={isAdmin && editMode}
                dragOver={itemDragOver === item.id}
                appearance={appearance}
                showDesc={displayOptions.showDesc}
                showTags={displayOptions.showTags}
                onDragStart={onItemDragStart}
                onDragOver={onItemDragOver}
                onDrop={onItemDrop}
                onDragLeave={() => setItemDragOver(null)}
                onEdit={() => onEditItem(section.id, item)}
                onDelete={() => setConfirmDel({ open: true, type: 'item', itemId: item.id, msg: `Hapus "${item.title}"?` })}
              />
            ))}
          </div>
        )}

        {q && filteredItems.length === 0 && (
          <div style={{ padding: '12px', fontSize: 11, color: 'var(--silver3)', textAlign: 'center' }}>
            Tidak ada hasil
          </div>
        )}
      </div>

      {/* ── Resize hint — hanya di edit mode ───────────── */}
      {isAdmin && editMode && (
        <div className="rgl-resize-hint" title="Drag untuk resize">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 9L9 2M5 9L9 5M8 9L9 8" stroke="var(--mint)" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>

      <ConfirmDialog
        open={confirmDel.open}
        title={confirmDel.type === 'section' ? 'Hapus Section' : 'Hapus Item'}
        message={confirmDel.msg}
        confirmLabel="Ya, Hapus"
        danger
        onConfirm={() => {
          if (confirmDel.type === 'unfavorite') {
            onToggleFavorite?.(section.id)  // lepas favorite
          } else if (confirmDel.type === 'section') {
            onDeleteSection(section.id)
          } else if (confirmDel.itemId) {
            deleteItem(section.id, confirmDel.itemId)
            toast('Item dihapus.', 'success')
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

// ── helper ────────────────────────────────────────────────
function handleItemClick(item: LinkItem, editMode: boolean) {
  if (editMode) return
  const url = sanitizeUrl(item.url)
  if (!url || url === '#') return
  if (item.newTab) window.open(url, '_blank', 'noopener noreferrer')
  else window.location.href = url
}

// ── LIST ITEM ─────────────────────────────────────────────
interface ListItemProps {
  item: LinkItem
  searchQuery: string
  editMode: boolean
  dragOver: boolean
  appearance: AppearanceSettings
  showDesc: boolean
  showTags: boolean
  onDragStart: (e: React.DragEvent, item: LinkItem) => void
  onDragOver:  (e: React.DragEvent, id: string) => void
  onDrop:      (e: React.DragEvent, id: string) => void
  onDragLeave: () => void
  onEdit:   () => void
  onDelete: () => void
}

function ListItem({ item, searchQuery, editMode, dragOver, appearance, showDesc, showTags, onDragStart, onDragOver, onDrop, onDragLeave, onEdit, onDelete }: ListItemProps) {
  const [hovered, setHovered] = useState(false)
  const isCompact  = appearance.itemDisplayMode === 'list'
  const isTextOnly = false  // removed: textOnly mode deprecated
  const isIconOnly = false  // removed: iconOnly mode deprecated
  const showLabel  = appearance.labelMode === 'show' || (appearance.labelMode === 'hover' && hovered)
  const showTooltip = appearance.tooltipEnabled && hovered && (
    isIconOnly || appearance.labelMode === 'hide' || (appearance.labelMode === 'hover' && item.desc)
  )

  return (
    <div
      className={`item-card${dragOver ? ' drag-over-item' : ''}`}
      style={{ padding: isCompact ? '3px 8px' : '6px 8px', position: 'relative' }}
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
      {!isTextOnly && (
        <AppIcon item={item} iconSize={isCompact ? 'small' : appearance.iconSize} faviconEnabled={appearance.faviconEnabled} />
      )}

      {!isIconOnly && showLabel && (
        <div className="item-text">
          <div className="item-title" dangerouslySetInnerHTML={{ __html: highlight(item.title, searchQuery) }} />
          {showDesc && item.desc && !isCompact && <div className="item-desc">{item.desc}</div>}
          {showTags && item.tags.length > 0 && (
            <div className="item-tags">
              {item.tags.map(t => <span key={t} className="item-tag">{t}</span>)}
            </div>
          )}
        </div>
      )}

      {isIconOnly && !showLabel && (
        <div className="item-text" style={{ opacity: 0 }} aria-hidden />
      )}

      {showTooltip && (
        <div className="item-tooltip-popup">
          <div style={{ fontWeight: 600, marginBottom: item.desc ? 2 : 0 }}>{item.title}</div>
          {item.desc && <div style={{ opacity: .7, fontSize: 11 }}>{item.desc}</div>}
        </div>
      )}

      {editMode && (
        <div className="item-action-group" onMouseDown={e => e.stopPropagation()}>
          <button className="item-edit-btn" onClick={e => { e.stopPropagation(); onEdit() }} title="Edit">✏️</button>
          <button className="item-delete-btn" onClick={e => { e.stopPropagation(); onDelete() }} title="Hapus">🗑</button>
        </div>
      )}
    </div>
  )
}

// ── FOLDER ITEM ───────────────────────────────────────────
interface FolderItemProps {
  item: LinkItem
  searchQuery: string
  editMode: boolean
  dragOver: boolean
  appearance: AppearanceSettings
  onDragStart: (e: React.DragEvent, item: LinkItem) => void
  onDragOver:  (e: React.DragEvent, id: string) => void
  onDrop:      (e: React.DragEvent, id: string) => void
  onDragLeave: () => void
  onEdit:   () => void
  onDelete: () => void
}

function FolderItem({ item, searchQuery, editMode, dragOver, appearance, onDragStart, onDragOver, onDrop, onDragLeave, onEdit, onDelete }: FolderItemProps) {
  const [hovered, setHovered] = useState(false)
  const showLabel = appearance.labelMode === 'show' || (appearance.labelMode === 'hover' && hovered)

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'flex-start', gap: 5,
        padding: '10px 4px 8px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${dragOver ? 'var(--mint)' : hovered ? 'rgba(0,255,194,0.22)' : 'transparent'}`,
        background: hovered ? 'rgba(0,255,194,0.06)' : dragOver ? 'var(--mint-bg)' : 'transparent',
        boxShadow: hovered ? '0 0 8px rgba(0,255,194,0.07)' : 'none',
        cursor: editMode ? 'default' : (item.url && item.url !== '#' ? 'pointer' : 'default'),
        transition: 'all .15s',
        position: 'relative', minHeight: 64,
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

      {appearance.tooltipEnabled && appearance.labelMode === 'hide' && hovered && (
        <div className="item-tooltip-popup" style={{ bottom: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)' }}>
          {item.title}
          {item.desc && <div style={{ opacity: .7, fontSize: 10, marginTop: 2 }}>{item.desc}</div>}
        </div>
      )}


      {editMode && (
        <div className="folder-action-group" onMouseDown={e => e.stopPropagation()}>

          <button className="folder-edit-btn" onClick={e => { e.stopPropagation(); onEdit() }} title="Edit">✏️</button>
          <button className="folder-delete-btn" onClick={e => { e.stopPropagation(); onDelete() }} title="Hapus">🗑</button>
        </div>
      )}
    </div>
  )
}
