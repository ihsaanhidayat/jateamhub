import { useState, useEffect } from 'react'
import Modal from './Modal'
import { useStore } from '../../store/dashboardStore'

interface Props { open: boolean; onClose: () => void }

export default function ConfigModal({ open, onClose }: Props) {
  const { config, setConfig, toast } = useStore()
  const [title, setTitle]     = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [navRaw, setNavRaw]   = useState('')
  const [adminKey, setAdminKey] = useState('')

  useEffect(() => {
    if (open) {
      setTitle(config.meta.title)
      setSubtitle(config.meta.subtitle)
      setLogoUrl(config.meta.logoUrl || '')
      setNavRaw(config.meta.nav.map(n => `${n.label}|${n.url}`).join('\n'))
      setAdminKey('')
    }
  }, [open, config])

  const handleSave = () => {
    const newConfig = {
      ...config,
      meta: {
        ...config.meta,
        title: title.trim() || 'JateamHub',
        subtitle: subtitle.trim(),
        logoUrl: logoUrl.trim() || '',
        nav: navRaw.trim()
          ? navRaw.split('\n').map(l => { const [label, url] = l.split('|'); return { label: (label||'').trim(), url: (url||'#').trim() } }).filter(n => n.label)
          : [],
        ...(adminKey.trim() ? { adminKey: adminKey.trim() } : {}),
      },
    }
    setConfig(newConfig)
    document.title = newConfig.meta.title
    toast('Config disimpan.', 'success')
    onClose()
  }

  return (
    <Modal open={open} title="App Config" onClose={onClose}
      footer={<><button className="btn-cancel" onClick={onClose}>Batal</button><button className="btn-save" onClick={handleSave}>Simpan</button></>}
    >
      <div className="field">
        <label>Site Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label>Subtitle / Greeting</label>
        <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Selamat datang, {username}" />
      </div>
      <div className="field">
        <label>Logo URL (opsional)</label>
        <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://... atau kosongkan untuk placeholder" />
        {logoUrl && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={logoUrl} alt="Logo preview" style={{ height: 28, maxWidth: 80, objectFit: 'contain', borderRadius: 4 }}
              onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
            <span style={{ fontSize: 11, color: 'var(--silver3)' }}>Preview</span>
          </div>
        )}
      </div>
      <div className="field">
        <label>Navigation Links (Label|URL, per baris)</label>
        <textarea value={navRaw} onChange={e => setNavRaw(e.target.value)} rows={5}
          placeholder={'BERANDA|/\nPANDUAN|https://...'} />
      </div>
      <div className="field">
        <label>Admin Key (kosong = tidak berubah)</label>
        <input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)} placeholder="••••••••" />
      </div>
    </Modal>
  )
}
