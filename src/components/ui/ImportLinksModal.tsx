import { useState, useMemo } from 'react'
import Modal from './Modal'
import { useStore } from '../../store/dashboardStore'

interface Props { open: boolean; onClose: () => void }

const extractUrls = (text: string): { url: string; title: string }[] => {
  const results: { url: string; title: string }[] = []
  const seen = new Set<string>()
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi
  const matches = text.match(urlRegex) || []
  for (const raw of matches) {
    const url = raw.replace(/[.,;:!?)\]]+$/, '')
    const lower = url.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      const name = domain.split('.')[0]
      results.push({ url, title: name.charAt(0).toUpperCase() + name.slice(1) })
    } catch { results.push({ url, title: url.slice(0, 30) }) }
  }
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^(.+?)\s*[-:–—]\s*(https?:\/\/\S+)/i)
    if (m) {
      const url = m[2].replace(/[.,;:!?)\]]+$/, '')
      const lower = url.toLowerCase()
      if (!seen.has(lower)) { seen.add(lower); results.push({ url, title: m[1].trim() }) }
      else { const e = results.find(r => r.url.toLowerCase() === lower); if (e && m[1].trim().length > 2) e.title = m[1].trim() }
    }
  }
  return results
}

const lSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--silver3)', textTransform: 'uppercase',
  letterSpacing: '0.8px', marginBottom: 6, fontFamily: 'var(--mono)',
}
const iSt: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 12px',
  background: 'var(--bg4)', border: '1px solid var(--border2)',
  borderRadius: 8, fontSize: 13, color: 'var(--silver)',
  fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box',
  appearance: 'auto' as any,
}

export default function ImportLinksModal({ open, onClose }: Props) {
  const [text, setText] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [importing, setImporting] = useState(false)
  const [tab, setTab] = useState<'import' | 'export'>('import')
  const [exportSection, setExportSection] = useState('')

  const personalSections = useStore(s => s.personalSections)
  const { addItem, syncPersonalToDb, toast } = useStore()

  const parsed = useMemo(() => extractUrls(text), [text])
  const sectionOptions = personalSections.filter(s => s.type === 'section')

  const handleImport = async () => {
    if (!selectedSection || parsed.length === 0) return
    setImporting(true)
    for (const link of parsed) {
      addItem(selectedSection, { title: link.title, url: link.url, icon: '', newTab: true } as any)
    }
    await syncPersonalToDb()
    toast(`${parsed.length} link berhasil diimport.`, 'success')
    setImporting(false); setText(''); setSelectedSection(''); onClose()
  }

  const handleExport = () => {
    const section = personalSections.find(s => s.id === exportSection)
    if (!section) return
    const lines = section.items.map((item: any) => `${item.title} - ${item.url}`).join('\n')
    const blob = new Blob([lines], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${section.title.toLowerCase().replace(/\s+/g, '-')}-links.txt`
    a.click(); URL.revokeObjectURL(url)
    toast(`${section.items.length} link diekspor.`, 'success')
  }

  const tabBtn = (id: 'import' | 'export'): React.CSSProperties => ({
    flex: 1, height: 34, border: 'none', cursor: 'pointer',
    background: tab === id ? 'var(--accent)' : 'var(--bg4)',
    color: tab === id ? 'white' : 'var(--silver3)',
    fontSize: 12, fontWeight: 600, borderRadius: 8,
    fontFamily: 'var(--font)', transition: 'all 150ms',
  })

  return (
    <Modal open={open} title="Import / Export Link" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg4)', padding: 4, borderRadius: 10 }}>
          <button style={tabBtn('import')} onClick={() => setTab('import')}>📥 Import</button>
          <button style={tabBtn('export')} onClick={() => setTab('export')}>📤 Export</button>
        </div>

        {tab === 'import' && (
          <>
            <div>
              <label style={lSt}>Section Tujuan</label>
              <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} style={iSt}>
                <option value="">— Pilih section —</option>
                {sectionOptions.map(s => <option key={s.id} value={s.id}>{s.icon} {s.title}</option>)}
              </select>
            </div>

            <div>
              <label style={lSt}>Paste Link</label>
              <textarea
                value={text} onChange={e => setText(e.target.value)} rows={5}
                placeholder={'https://google.com\nFacebook - https://facebook.com\nGithub: https://github.com'}
                style={{
                  width: '100%', resize: 'vertical', padding: '10px 12px',
                  background: 'var(--bg4)', border: '1px solid var(--border2)',
                  borderRadius: 8, color: 'var(--silver)', fontSize: 13,
                  fontFamily: 'var(--mono)', lineHeight: 1.6, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {parsed.length > 0 && (
              <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--silver3)', marginBottom: 8 }}>
                  {parsed.length} link ditemukan
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 130, overflowY: 'auto' }}>
                  {parsed.map((link, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>{link.title}</span>
                      <span style={{ fontSize: 11, color: 'var(--silver4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" style={{ height: 36 }} onClick={onClose}>Batal</button>
              <button
                className="btn btn-primary" style={{ height: 36 }}
                disabled={!selectedSection || parsed.length === 0 || importing}
                onClick={handleImport}
              >
                {importing ? 'Mengimport...' : `Import ${parsed.length} Link`}
              </button>
            </div>
          </>
        )}

        {tab === 'export' && (
          <>
            <div>
              <label style={lSt}>Pilih Section</label>
              <select value={exportSection} onChange={e => setExportSection(e.target.value)} style={iSt}>
                <option value="">— Pilih section —</option>
                {sectionOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.icon} {s.title} ({s.items.length} link)</option>
                ))}
              </select>
            </div>

            {exportSection && (
              <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--silver3)', marginBottom: 6, fontWeight: 700 }}>Preview</div>
                <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {personalSections.find(s => s.id === exportSection)?.items.map((item: any) => (
                    <div key={item.id} style={{ fontSize: 12, color: 'var(--silver2)', fontFamily: 'var(--mono)' }}>
                      {item.title} — <span style={{ color: 'var(--silver4)' }}>{item.url}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" style={{ height: 36 }} onClick={onClose}>Batal</button>
              <button
                className="btn btn-primary" style={{ height: 36 }}
                disabled={!exportSection}
                onClick={handleExport}
              >
                📤 Export ke .txt
              </button>
            </div>
          </>
        )}

      </div>
    </Modal>
  )
}
