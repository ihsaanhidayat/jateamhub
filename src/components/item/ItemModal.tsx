import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import AppIcon from '../ui/AppIcon'
import { useStore } from '../../store/dashboardStore'
import { useT } from '../../utils/i18n'
import type { LinkItem } from '../../types'

interface Props {
  open:      boolean
  sectionId: string
  item:      LinkItem | null
  onClose:   () => void
}

export default function ItemModal({ open, sectionId, item, onClose }: Props) {
  const t = useT()
  const [title,      setTitle]      = useState('')
  const [url,        setUrl]        = useState('https://')
  const [desc,       setDesc]       = useState('')
  const [iconUrl,    setIconUrl]    = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(item?.title ?? '')
      setUrl(item?.url ?? 'https://')
      setDesc(item?.desc ?? '')
      setIconUrl(item?.iconUrl ?? '')
      setConfirmDel(false)
    }
  }, [open, item])

  const handleSave = () => {
    const { addItem, updateItem, toast } = useStore.getState()
    if (!title.trim()) { toast('Nama link wajib diisi.', 'error'); return }
    if (!url.trim() || url === 'https://') { toast('URL wajib diisi.', 'error'); return }
    const data: Omit<LinkItem, 'id'> = {
      title: title.trim(), url: url.trim(), desc: desc.trim(),
      icon: '', iconUrl: iconUrl.trim() || undefined,
      useFavicon: true, newTab: true, tags: [],
    }
    if (item) { updateItem(sectionId, item.id, data); toast('Link diperbarui.', 'success') }
    else       { addItem(sectionId, data);             toast('Link ditambahkan.', 'success') }
    onClose()
  }

  const handleDelete = () => {
    if (!item) return
    const { deleteItem, toast } = useStore.getState()
    deleteItem(sectionId, item.id)
    toast('Link dihapus.', 'success')
    onClose()
  }

  const previewItem: LinkItem = {
    id: 'preview', title: title || 'Preview', url: url || '#',
    icon: '', desc: '', iconUrl: iconUrl || undefined, useFavicon: true, tags: [], newTab: true,
  }

  const iSt: React.CSSProperties = {
    width: '100%', height: 40, padding: '0 12px',
    background: 'var(--bg4)', border: '1px solid var(--border2)',
    borderRadius: 8, fontSize: 13, color: 'var(--silver)',
    fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 150ms',
  }
  const lSt: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--silver3)', textTransform: 'uppercase',
    letterSpacing: '0.8px', marginBottom: 6, fontFamily: 'var(--mono)',
  }

  return (
    <Modal
      open={open}
      title={item ? t('item.edit') : t('item.add')}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
          {/* Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <AppIcon item={previewItem} iconSize="medium" faviconEnabled={true} />
            <span style={{ fontSize: 12, color: 'var(--silver2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title || 'Preview'}
            </span>
          </div>
          {item && (
            confirmDel ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t('confirm.del')}</span>
                <button className="btn btn-danger" style={{ height: 30, padding: '0 8px', fontSize: 11 }} onClick={handleDelete}>{t('yes')}</button>
                <button className="btn btn-secondary" style={{ height: 30, padding: '0 8px', fontSize: 11 }} onClick={() => setConfirmDel(false)}>{t('no')}</button>
              </div>
            ) : (
              <button className="btn btn-danger" style={{ height: 34, padding: '0 10px' }} onClick={() => setConfirmDel(true)}>🗑</button>
            )
          )}
          <button className="btn btn-secondary" style={{ height: 34 }} onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-primary" style={{ height: 34 }} onClick={handleSave}>{t('save')}</button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={lSt}>{t('item.name')}</label>
          <input
            className="input" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Contoh: Email Korporat" autoFocus style={iSt}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e  => e.target.style.borderColor = 'var(--border2)'}
          />
        </div>
        <div>
          <label style={lSt}>{t('item.urlreq')}</label>
          <input
            style={iSt} value={url} type="url"
            onChange={e => setUrl(e.target.value)}
            onFocus={e => { if (e.target.value === 'https://') e.target.select(); e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e  => e.target.style.borderColor = 'var(--border2)'}
            placeholder="https://contoh.com"
          />
        </div>
        <div>
          <label style={lSt}>{t('item.popup')}</label>
          <input
            style={iSt} value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Tampil saat kursor diarahkan ke icon link..."
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e  => e.target.style.borderColor = 'var(--border2)'}
          />
        </div>
        <div>
          <label style={lSt}>{t('item.icon')}</label>
          <input
            style={iSt} value={iconUrl} onChange={e => setIconUrl(e.target.value)}
            placeholder="https://domain.com/icon.png"
            onFocus={e => { if (!e.target.value) setIconUrl('https://'); e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e  => { if (e.target.value === 'https://') setIconUrl(''); e.target.style.borderColor = 'var(--border2)' }}
          />
        </div>
      </div>
    </Modal>
  )
}
