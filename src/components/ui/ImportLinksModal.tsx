// ─────────────────────────────────────────────────────────────
// ImportLinksModal — Paste teks berisi URL, parse otomatis, pilih section
// Tidak menyentuh file inti (store/auth/App)
// ─────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import Modal from './Modal'
import { useStore } from '../../store/dashboardStore'

interface Props {
  open: boolean
  onClose: () => void
}

// Extract semua URL dari teks
const extractUrls = (text: string): { url: string; title: string }[] => {
  const results: { url: string; title: string }[] = []
  const seen = new Set<string>()

  // Pattern: match http/https URLs
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi
  const matches = text.match(urlRegex) || []

  for (const raw of matches) {
    // Bersihkan trailing punctuation
    const url = raw.replace(/[.,;:!?)}\]]+$/, '')
    const lower = url.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)

    // Generate title dari domain
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      const name = domain.split('.')[0]
      const title = name.charAt(0).toUpperCase() + name.slice(1)
      results.push({ url, title })
    } catch {
      results.push({ url, title: url.slice(0, 30) })
    }
  }

  // Juga parse format "Nama - URL" atau "Nama: URL" per baris
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Format: "Nama - https://..." atau "Nama: https://..."
    const match = trimmed.match(/^(.+?)\s*[-:–—]\s*(https?:\/\/\S+)/i)
    if (match) {
      const title = match[1].trim()
      const url = match[2].replace(/[.,;:!?)}\]]+$/, '')
      const lower = url.toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        results.push({ url, title })
      } else {
        // URL sudah ada, update title-nya
        const existing = results.find(r => r.url.toLowerCase() === lower)
        if (existing && title.length > 2) existing.title = title
      }
    }
  }

  return results
}

export default function ImportLinksModal({ open, onClose }: Props) {
  const [text, setText] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [importing, setImporting] = useState(false)

  const personalSections = useStore(s => s.personalSections)
  const { addItem, syncPersonalToDb, toast } = useStore()

  const parsed = useMemo(() => extractUrls(text), [text])

  // Hanya section type (bukan widget)
  const sectionOptions = personalSections.filter(s => s.type === 'section')

  const handleImport = async () => {
    if (!selectedSection || parsed.length === 0) return
    setImporting(true)

    for (const link of parsed) {
      addItem(selectedSection, {
        title: link.title,
        url: link.url,
        icon: '',
        newTab: true,
      } as any)
    }

    await syncPersonalToDb()
    toast(`${parsed.length} link berhasil diimport.`, 'success')
    setImporting(false)
    setText('')
    setSelectedSection('')
    onClose()
  }

  if (!open) return null

  return (
    <Modal open={open} title="Import Link" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Pilih section */}
        <div>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 700,
            color: 'var(--silver3)', marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>Pilih Section Tujuan</label>
          <select
            value={selectedSection}
            onChange={e => setSelectedSection(e.target.value)}
            style={{
              width: '100%', height: 40,
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)', padding: '0 10px',
              color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)',
            }}
          >
            <option value="">— Pilih section —</option>
            {sectionOptions.map(s => (
              <option key={s.id} value={s.id}>{s.icon} {s.title}</option>
            ))}
          </select>
        </div>

        {/* Textarea paste */}
        <div>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 700,
            color: 'var(--silver3)', marginBottom: 6,
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>Paste Link (satu atau banyak)</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={`Contoh:\nhttps://google.com\nFacebook - https://facebook.com\nGithub: https://github.com`}
            rows={6}
            style={{
              width: '100%', resize: 'vertical',
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)', padding: 10,
              color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--mono)',
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Preview */}
        {parsed.length > 0 && (
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--silver3)', marginBottom: 8 }}>
              {parsed.length} link ditemukan:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
              {parsed.map((link, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>{link.title}</span>
                  <span style={{ color: 'var(--silver3)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            height: 38, padding: '0 16px',
            background: 'none', border: '1px solid var(--border2)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--silver2)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>Batal</button>
          <button
            onClick={handleImport}
            disabled={!selectedSection || parsed.length === 0 || importing}
            style={{
              height: 38, padding: '0 20px',
              background: (!selectedSection || parsed.length === 0) ? 'var(--border2)' : 'var(--accent)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: 'white', fontSize: 12, fontWeight: 700,
              cursor: (!selectedSection || parsed.length === 0) ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)',
              opacity: importing ? 0.6 : 1,
            }}
          >
            {importing ? 'Mengimport...' : `Import ${parsed.length} Link`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
