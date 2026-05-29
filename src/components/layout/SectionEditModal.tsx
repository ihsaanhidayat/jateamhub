import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { useStore } from '../../store/dashboardStore'
import type { Section } from '../../types'

interface Props { open: boolean; section: Section; onClose: () => void }

export default function SectionEditModal({ open, section, onClose }: Props) {
  const { updatePersonalSection, syncPersonalToDb, deletePersonalSection, toast } = useStore()
  const [title,    setTitle]    = useState(section.title)
  const [icon,     setIcon]     = useState(section.icon ?? '')
  const [subtitle, setSubtitle] = useState(section.subtitle ?? '')

  useEffect(() => {
    setTitle(section.title); setIcon(section.icon ?? ''); setSubtitle(section.subtitle ?? '')
  }, [section.id])

  const handleSave = () => {
    updatePersonalSection(section.id, { title: title.trim() || 'Section', icon, subtitle })
    syncPersonalToDb()
    toast('Section diperbarui.', 'success')
    onClose()
  }

  const handleDelete = () => {
    if (!confirm(`Hapus section "${section.title}" dan semua isinya?`)) return
    deletePersonalSection(section.id)
    syncPersonalToDb()
    onClose()
  }

  return (
    <Modal open={open} title="Edit Section" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="input-label">Icon</label>
          <input className="input" value={icon} onChange={e => setIcon(e.target.value)} placeholder="📁" maxLength={4} />
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
          <button className="btn btn-danger" onClick={handleDelete}>🗑 Hapus Section</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button className="btn btn-primary" onClick={handleSave}>Simpan</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
