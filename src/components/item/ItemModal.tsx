import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import AppIcon from '../ui/AppIcon'
import { useStore } from '../../store/dashboardStore'
import type { LinkItem } from '../../types'

interface Props {
  open: boolean
  sectionId: string
  item: LinkItem | null
  onClose: () => void
}

export default function ItemModal({ open, sectionId, item, onClose }: Props) {
  const { addItem, updateItem, deleteItem, toast, appearance } = useStore()
  const [title, setTitle]         = useState('')
  const [url, setUrl]             = useState('')
  const [desc, setDesc]           = useState('')
  const [icon, setIcon]           = useState('')
  const [iconUrl, setIconUrl]     = useState('')
  const [useFavicon, setUseFavicon] = useState(true)
  const [tags, setTags]           = useState('')
  const [newTab, setNewTab]       = useState(true)

  useEffect(() => {
    if (open) {
      setTitle(item?.title ?? '')
      setUrl(item?.url ?? '')
      setDesc(item?.desc ?? '')
      setIcon(item?.icon ?? '')
      setIconUrl(item?.iconUrl ?? '')
      setUseFavicon(item?.useFavicon ?? true)
      setTags(item?.tags.join(',') ?? '')
      setNewTab(item?.newTab ?? true)
    }
  }, [open, item])

  const handleSave = () => {
    if (!title.trim() || !url.trim()) { toast('Title dan URL wajib diisi.', 'error'); return }
    const data: Omit<LinkItem, 'id'> = {
      title: title.trim(), url: url.trim(),
      desc: desc.trim(),
      icon: icon.trim(),
      iconUrl: iconUrl.trim() || undefined,
      useFavicon,
      newTab,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    }
    if (item) { updateItem(sectionId, item.id, data); toast('Link diperbarui.', 'success') }
    else       { addItem(sectionId, data);             toast('Link ditambahkan.', 'success') }
    onClose()
  }

  const handleDelete = () => {
    if (!item) return
    if (!confirm('Hapus link ini?')) return
    deleteItem(sectionId, item.id)
    toast('Link dihapus.', 'success')
    onClose()
  }

  // preview item
  const previewItem: LinkItem = {
    id: 'preview', title: title || 'Preview', url: url || '#',
    icon, desc: '', iconUrl: iconUrl || undefined, useFavicon, tags: [], newTab,
  }

  return (
    <Modal
      open={open}
      title={item ? 'Edit Link' : 'Tambah Link'}
      onClose={onClose}
      footer={
        <>
          {item && <button className="btn-delete" onClick={handleDelete}>🗑 Hapus</button>}
          <button className="btn-cancel" onClick={onClose}>Batal</button>
          <button className="btn-save" onClick={handleSave}>Simpan</button>
        </>
      }
    >
      <div className="field">
        <label>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Email Korporat" autoFocus />
      </div>
      <div className="field">
        <label>URL</label>
        <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div className="field">
        <label>Deskripsi (opsional)</label>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Keterangan singkat" />
      </div>

      {/* Icon section */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--silver3)', marginBottom: 10 }}>Icon</div>

        <div className="field-row">
          <div className="field">
            <label>Emoji / Teks</label>
            <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🔧 atau teks" />
          </div>
          <div className="field">
            <label>Custom Icon URL</label>
            <input value={iconUrl} onChange={e => setIconUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div className="checkbox-row" style={{ marginBottom: 10 }}>
          <input type="checkbox" id="useFavicon" checked={useFavicon} onChange={e => setUseFavicon(e.target.checked)} />
          <label htmlFor="useFavicon">Auto-fetch favicon dari URL</label>
        </div>

        {/* Icon preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--silver3)' }}>Preview:</span>
          <AppIcon item={previewItem} iconSize={appearance.iconSize} faviconEnabled={appearance.faviconEnabled} />
          <span style={{ fontSize: 12, color: 'var(--silver2)' }}>{title || 'Nama Link'}</span>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Tags (opsional)</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="tag1,tag2" />
        </div>
      </div>
      <div className="field">
        <div className="checkbox-row">
          <input type="checkbox" id="newtab" checked={newTab} onChange={e => setNewTab(e.target.checked)} />
          <label htmlFor="newtab">Buka di tab baru</label>
        </div>
      </div>
    </Modal>
  )
}
