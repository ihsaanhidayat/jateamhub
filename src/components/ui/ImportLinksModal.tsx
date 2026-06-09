import { useState, useMemo } from 'react'
import Modal from '../ui/Modal'
import { useStore } from '../../store/dashboardStore'

interface Props { open: boolean; onClose: () => void }
interface ParsedLink { url: string; title: string; popup: string }

// Auto-parse teks bebas → judul + URL + popup text
function parseLinks(text: string): ParsedLink[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const seen  = new Set<string>()
  const out: ParsedLink[] = []

  for (const line of lines) {
    // Format: Judul - https://... | popup
    // Format: Judul: https://... | popup
    // Format: https://... | popup
    const urlMatch = line.match(/https?:\/\/[^\s<>"')\]|]+/i)
    if (!urlMatch) continue
    const url = urlMatch[0].replace(/[.,;:!?)\]]+$/, '')
    if (seen.has(url.toLowerCase())) continue
    seen.add(url.toLowerCase())

    // Cari judul di kiri URL
    const beforeUrl = line.slice(0, line.indexOf(urlMatch[0])).replace(/[-:–—]\s*$/, '').trim()
    // Cari popup di kanan URL (setelah | atau //)
    const afterUrl  = line.slice(line.indexOf(urlMatch[0]) + urlMatch[0].length)
    const popupMatch = afterUrl.match(/[|\/\/]\s*(.+)/)
    const popup = popupMatch ? popupMatch[1].trim() : ''

    // Judul: dari teks, atau dari domain
    let title = beforeUrl
    if (!title) {
      try {
        const domain = new URL(url).hostname.replace('www.', '')
        title = domain.split('.')[0]
        title = title.charAt(0).toUpperCase() + title.slice(1)
      } catch { title = url.slice(0, 30) }
    }

    out.push({ url, title, popup })
  }
  return out
}

const lSt: React.CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 600,
  color: 'var(--silver4)', textTransform: 'uppercase',
  letterSpacing: '0.7px', marginBottom: 5, fontFamily: 'var(--mono)',
}
const iSt: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 10px',
  background: 'var(--bg4)', border: '1px solid var(--border)',
  borderRadius: 6, fontSize: 12, color: 'var(--silver)',
  fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box',
}

export default function ImportLinksModal({ open, onClose }: Props) {
  const [text,            setText]           = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [importing,       setImporting]       = useState(false)
  const [tab,             setTab]             = useState<'import'|'export'>('import')
  const [exportSection,   setExportSection]   = useState('')
  const [edits,           setEdits]           = useState<ParsedLink[]>([])
  const [previewing,      setPreviewing]      = useState(false)

  const personalSections = useStore(s => s.personalSections)
  const sectionOptions = personalSections.filter(s => s.type === 'section')

  const parsed = useMemo(() => parseLinks(text), [text])

  const handlePreview = () => {
    setEdits(parsed.map(p => ({ ...p })))
    setPreviewing(true)
  }

  const updateEdit = (i: number, field: keyof ParsedLink, val: string) =>
    setEdits(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e))

  const removeEdit = (i: number) =>
    setEdits(prev => prev.filter((_, idx) => idx !== i))

  const handleImport = () => {
    if (!selectedSection || !edits.length) return
    setImporting(true)
    const store = useStore.getState()
    for (const link of edits) {
      if (!link.url.trim() || !link.title.trim()) continue
      store.addItem(selectedSection, {
        title: link.title.trim(), url: link.url.trim(),
        desc: link.popup.trim(), icon: '', newTab: true,
      } as any)
    }
    store.syncPersonalToDb()
    store.toast(`${edits.length} link berhasil diimport.`, 'success')
    setImporting(false)
    setText(''); setEdits([]); setPreviewing(false); setSelectedSection('')
    onClose()
  }

  const handleExport = () => {
    const section = personalSections.find(s => s.id === exportSection)
    if (!section) return
    const lines = section.items.map((item: any) =>
      item.desc ? `${item.title} - ${item.url} | ${item.desc}` : `${item.title} - ${item.url}`
    ).join('\n')
    const blob = new Blob([lines], { type: 'text/plain' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${section.title.toLowerCase().replace(/\s+/g, '-')}-links.txt`
    a.click()
    useStore.getState().toast(`${section.items.length} link diekspor.`, 'success')
  }

  const tabSt = (id: 'import'|'export'): React.CSSProperties => ({
    flex: 1, height: 32, border: 'none', cursor: 'pointer',
    background: tab === id ? 'var(--accent)' : 'transparent',
    color: tab === id ? 'white' : 'var(--silver3)',
    fontSize: 12, fontWeight: 600, borderRadius: 6,
    fontFamily: 'var(--font)', transition: 'all 150ms',
  })

  return (
    <Modal open={open} title="Import / Export Link" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg4)', padding: 3, borderRadius: 8 }}>
          <button style={tabSt('import')} onClick={() => { setTab('import'); setPreviewing(false) }}>📥 Import</button>
          <button style={tabSt('export')} onClick={() => setTab('export')}>📤 Export</button>
        </div>

        {/* ── IMPORT ── */}
        {tab === 'import' && !previewing && (
          <>
            <div>
              <label style={lSt}>Tempel teks — URL otomatis terdeteksi</label>
              <textarea
                value={text} onChange={e => setText(e.target.value)}
                placeholder={
`Contoh format yang didukung:

Google - https://google.com
https://notion.so
Dashboard - https://app.example.com | Buka dashboard utama
Supabase: https://supabase.com | Database & auth`}
                style={{
                  ...iSt, height: 160, padding: '10px', resize: 'none',
                  lineHeight: '1.6', fontSize: 12,
                }}
              />
              {text && (
                <div style={{ fontSize: 11, color: parsed.length > 0 ? 'var(--green)' : 'var(--silver4)', marginTop: 5, fontFamily: 'var(--mono)' }}>
                  {parsed.length > 0 ? `✓ ${parsed.length} link terdeteksi` : '⚠ Tidak ada link ditemukan'}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--silver3)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: 'var(--silver2)', marginBottom: 3 }}>Format yang didukung:</div>
              <div><code style={{ color: 'var(--accent)', fontSize: 10.5 }}>Judul - URL</code> &nbsp; atau &nbsp; <code style={{ color: 'var(--accent)', fontSize: 10.5 }}>Judul: URL</code></div>
              <div><code style={{ color: 'var(--accent)', fontSize: 10.5 }}>URL | Teks popup</code> &nbsp;← teks setelah | jadi tooltip hover</div>
              <div><code style={{ color: 'var(--accent)', fontSize: 10.5 }}>URL</code> &nbsp;← judul otomatis dari nama domain</div>
            </div>

            <button onClick={handlePreview} disabled={parsed.length === 0}
              style={{ height: 38, background: parsed.length > 0 ? 'var(--accent)' : 'var(--bg4)', border: 'none', borderRadius: 8, color: parsed.length > 0 ? 'white' : 'var(--silver4)', fontSize: 13, fontWeight: 700, cursor: parsed.length > 0 ? 'pointer' : 'default', fontFamily: 'var(--font)' }}>
              Preview & Edit {parsed.length > 0 ? `(${parsed.length} link)` : ''}
            </button>
          </>
        )}

        {/* ── PREVIEW & EDIT ── */}
        {tab === 'import' && previewing && (
          <>
            <div>
              <label style={lSt}>Section tujuan</label>
              <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} style={iSt}>
                <option value="">— Pilih section —</option>
                {sectionOptions.map(s => <option key={s.id} value={s.id}>{s.icon} {s.title}</option>)}
              </select>
            </div>

            {/* Header kolom */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 20px', gap: 5 }}>
              {['Judul', 'URL', 'Teks popup (hover)', ''].map(h => (
                <span key={h} style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--silver4)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</span>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto', scrollbarWidth: 'none' }}>
              {edits.map((e, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 20px', gap: 5, alignItems: 'center' }}>
                  <input value={e.title} onChange={v => updateEdit(i, 'title', v.target.value)}
                    style={{ ...iSt, height: 30, fontSize: 11 }} placeholder="Judul" />
                  <input value={e.url} onChange={v => updateEdit(i, 'url', v.target.value)}
                    style={{ ...iSt, height: 30, fontSize: 10, color: 'var(--silver3)' }} placeholder="URL" />
                  <input value={e.popup} onChange={v => updateEdit(i, 'popup', v.target.value)}
                    style={{ ...iSt, height: 30, fontSize: 11 }} placeholder="Teks saat hover..." />
                  <button onClick={() => removeEdit(i)} style={{ width: 20, height: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver4)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--silver4)')}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 10.5, color: 'var(--silver4)', background: 'var(--bg4)', padding: '7px 10px', borderRadius: 6 }}>
              💡 <b>Teks popup</b> muncul saat kursor diarahkan ke icon link di dashboard
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPreviewing(false)} style={{ flex: 1, height: 36, background: 'none', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--silver3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>← Kembali</button>
              <button onClick={handleImport} disabled={importing || !selectedSection || !edits.length}
                style={{ flex: 2, height: 36, background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', opacity: (!selectedSection || !edits.length) ? 0.5 : 1 }}>
                {importing ? 'Mengimpor...' : `Import ${edits.length} Link`}
              </button>
            </div>
          </>
        )}

        {/* ── EXPORT ── */}
        {tab === 'export' && (
          <>
            <div>
              <label style={lSt}>Pilih section untuk diekspor</label>
              <select value={exportSection} onChange={e => setExportSection(e.target.value)} style={iSt}>
                <option value="">— Pilih section —</option>
                {sectionOptions.map(s => <option key={s.id} value={s.id}>{s.icon} {s.title} ({s.items.length} link)</option>)}
              </select>
            </div>

            {exportSection && (() => {
              const sec = personalSections.find(s => s.id === exportSection)
              if (!sec?.items.length) return null
              return (
                <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, maxHeight: 160, overflowY: 'auto', scrollbarWidth: 'none' }}>
                  {sec.items.map((item: any) => (
                    <div key={item.id} style={{ fontSize: 11, color: 'var(--silver2)', padding: '3px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                      <span style={{ flex: 1, fontWeight: 600 }}>{item.title}</span>
                      <span style={{ color: 'var(--silver4)', fontSize: 10, fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{item.url}</span>
                    </div>
                  ))}
                </div>
              )
            })()}

            <div style={{ fontSize: 10.5, color: 'var(--silver4)', background: 'var(--bg4)', padding: '7px 10px', borderRadius: 6 }}>
              💡 Format ekspor: <code style={{ color: 'var(--accent)' }}>Judul - URL | Popup text</code> — bisa langsung di-import ulang
            </div>

            <button onClick={handleExport} disabled={!exportSection}
              style={{ height: 36, background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: exportSection ? 'pointer' : 'default', fontFamily: 'var(--font)', opacity: !exportSection ? 0.5 : 1 }}>
              Ekspor sebagai .txt
            </button>
          </>
        )}

      </div>
    </Modal>
  )
}
