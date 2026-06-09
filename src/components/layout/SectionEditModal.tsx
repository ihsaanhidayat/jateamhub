import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import EmojiPicker from '../ui/EmojiPicker'
import { useStore } from '../../store/dashboardStore'
import type { Section } from '../../types'

interface Props { open: boolean; section: Section; onClose: () => void }

export default function SectionEditModal({ open, section, onClose }: Props) {
  const [title,       setTitle]       = useState(section.title)
  const [icon,        setIcon]        = useState(section.icon ?? '')
  const [subtitle,    setSubtitle]    = useState(section.subtitle ?? '')
  const [showPicker,  setShowPicker]  = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)

  useEffect(() => {
    setTitle(section.title); setIcon(section.icon ?? ''); setSubtitle(section.subtitle ?? '')
    setConfirmDel(false)
  }, [section.id])

  const handleSave = () => {
    const { updatePersonalSection, syncPersonalToDb, toast } = useStore.getState()
    updatePersonalSection(section.id, { title: title.trim() || 'Section', icon, subtitle })
    syncPersonalToDb()
    toast('Section diperbarui.', 'success')
    onClose()
  }

  const handleDelete = () => {
    const { deletePersonalSection, syncPersonalToDb } = useStore.getState()
    deletePersonalSection(section.id)
    syncPersonalToDb()
    onClose()
  }

  return (
    <Modal open={open} title="Edit Section" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="input-label">Icon</label>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button onClick={() => setShowPicker(v => !v)} style={{
              width: 48, height: 48, borderRadius: 10,
              background: 'var(--bg4)', border: '2px solid var(--border2)',
              fontSize: 24, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 150ms',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
            >{icon || '📁'}</button>
            {showPicker && <EmojiPicker value={icon} onChange={setIcon} onClose={() => setShowPicker(false)} />}
          </div>
        </div>
        <div>
          <label className="input-label">Nama Section</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Nama section" autoFocus />
        </div>
        <div>
          <label className="input-label">Deskripsi (opsional)</label>
          <input className="input" value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Deskripsi singkat" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          {confirmDel ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>Yakin hapus?</span>
              <button className="btn btn-danger" onClick={handleDelete} style={{ padding: '0 10px', height: 30, fontSize: 12 }}>Ya</button>
              <button className="btn btn-secondary" onClick={() => setConfirmDel(false)} style={{ padding: '0 10px', height: 30, fontSize: 12 }}>Batal</button>
            </div>
          ) : (
            <button className="btn btn-danger" onClick={() => setConfirmDel(true)}>🗑 Hapus Section</button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button className="btn btn-primary" onClick={handleSave}>Simpan</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
