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
  const [title,   setTitle]   = useState('')
  const [url,     setUrl]     = useState('https://')
  const [desc,    setDesc]    = useState('')
  const [iconUrl, setIconUrl] = useState('')

  // useFavicon dan newTab selalu true — tidak ditampilkan di UI
  const useFavicon = true
  const newTab     = true

  useEffect(() => {
    if (open) {
      setTitle(item?.title ?? '')
      // Edit: tampilkan URL asli; Tambah baru: default https://
      setUrl(item?.url ?? 'https://')
      setDesc(item?.desc ?? '')
      setIconUrl(item?.iconUrl ?? '')
    }
  }, [open, item])

  const handleSave = () => {
    if (!title.trim()) { toast('Nama link wajib diisi.', 'error'); return }
    if (!url.trim() || url === 'https://') { toast('URL wajib diisi.', 'error'); return }
    const data: Omit<LinkItem, 'id'> = {
      title:    title.trim(),
      url:      url.trim(),
      desc:     desc.trim(),
      icon:     '',
      iconUrl:  iconUrl.trim() || undefined,
      useFavicon,
      newTab,
      tags:     [],
    }
    if (item) { updateItem(sectionId, item.id, data); toast('Link diperbarui.', 'success') }
    else       { addItem(sectionId, data);             toast('Link ditambahkan.', 'success') }
    onClose()
  }

  const handleDelete = () => {
    if (!item || !confirm('Hapus link ini?')) return
    deleteItem(sectionId, item.id)
    toast('Link dihapus.', 'success')
    onClose()
  }

  const previewItem: LinkItem = {
    id: 'preview', title: title || 'Preview', url: url || '#',
    icon: '', desc: '', iconUrl: iconUrl || undefined, useFavicon, tags: [], newTab,
  }

  return (
    <Modal
      open={open}
      title={item ? 'Edit Link' : 'Tambah Link'}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
          {/* Preview di pojok kiri bawah */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <AppIcon item={previewItem} iconSize="medium" faviconEnabled={true} />
            <span style={{ fontSize: 12, color: 'var(--silver2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title || 'Preview'}
            </span>
          </div>
          {/* Tombol di kanan */}
          {item && <button className="btn-cancel" onClick={handleDelete} style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }}>🗑</button>}
          <button className="btn-cancel" onClick={onClose}>Batal</button>
          <button className="btn-save" onClick={handleSave}>Simpan</button>
        </div>
      }
    >
      <div className="field">
        <label>Nama Link</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Contoh: Email Korporat" autoFocus />
      </div>

      <div className="field">
        <label>URL</label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onFocus={e => { if (e.target.value === 'https://') e.target.select() }}
          placeholder="https://contoh.com"
          type="url"
        />
      </div>

      <div className="field">
        <label>Deskripsi (opsional)</label>
        <input value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Keterangan singkat" />
      </div>

      <div className="field">
        <label>Custom Icon URL (opsional)</label>
        <input value={iconUrl} onChange={e => setIconUrl(e.target.value)}
          placeholder="https://domain.com/icon.png"
          onFocus={e => { if (!e.target.value) setIconUrl('https://') }}
          onBlur={e  => { if (e.target.value === 'https://') setIconUrl('') }}
        />
      </div>
    </Modal>
  )
}
