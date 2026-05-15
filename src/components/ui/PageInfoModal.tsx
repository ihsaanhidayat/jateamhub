import { useState, useEffect } from 'react'
import Modal from './Modal'
import { useStore } from '../../store/dashboardStore'

interface Props { open: boolean; onClose: () => void }

export default function PageInfoModal({ open, onClose }: Props) {
  const { config, setConfig, toast } = useStore()
  const [title, setTitle] = useState('')
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    if (open) { setTitle(config.meta.title); setGreeting(config.meta.subtitle) }
  }, [open, config])

  const handleSave = () => {
    const newConfig = { ...config, meta: { ...config.meta, title: title.trim() || 'JateamHub', subtitle: greeting.trim() } }
    setConfig(newConfig)
    document.title = newConfig.meta.title
    toast('Page info disimpan.', 'success')
    onClose()
  }

  return (
    <Modal open={open} title="Edit Page Info" onClose={onClose}
      footer={
        <>
          <button className="btn-cancel" onClick={onClose}>Batal</button>
          <button className="btn-save" onClick={handleSave}>Simpan</button>
        </>
      }
    >
      <div className="field">
        <label>Page Title (browser tab)</label>
        <input value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>Greeting Text</label>
        <input value={greeting} onChange={e => setGreeting(e.target.value)} placeholder="Selamat datang, {username}" />
      </div>
    </Modal>
  )
}
