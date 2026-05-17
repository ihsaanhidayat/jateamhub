// ─────────────────────────────────────────────────────────────
// SECTION MODAL — Form tambah/edit section pribadi
// Visibility options berbeda per role user
// Page dropdown DIHAPUS — semua section di beranda
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import type { Section } from '../../types'
import { REGIONS, UNITS } from '../../types'

interface Props {
  open:    boolean
  section: Section | null  // null = mode tambah baru
  onClose: () => void
}

// Pilihan accent color untuk section
const ACCENT_COLORS = [
  'var(--accent)', '#00BFFF', '#FF6B6B', '#FFD93D',
  '#C77DFF', '#FF8C42', '#A78BFA', '#34D399',
]

export default function SectionModal({ open, section, onClose }: Props) {
  const { addPersonalSection, updatePersonalSection, toast } = useStore()
  const { profile } = useAuthStore()

  // State form
  const [title,      setTitle]      = useState('')
  const [icon,       setIcon]       = useState('📁')
  const [subtitle,   setSubtitle]   = useState('')
  const [accent,     setAccent]     = useState(ACCENT_COLORS[0])
  const [type,       setType]       = useState<'section' | 'widget'>('section')
  const [widgetType, setWidgetType] = useState<'clock' | 'notes'>('clock')
  const [colW,       setColW]       = useState(3)

  // Isi form saat edit section yang sudah ada
  useEffect(() => {
    if (section) {
      setTitle(section.title)
      setIcon(section.icon ?? '📁')
      setSubtitle(section.subtitle ?? '')
      setAccent(section.accentColor ?? ACCENT_COLORS[0])
      setType((section.type ?? 'section') as 'section' | 'widget')
      setWidgetType((section.widgetType ?? 'clock') as 'clock' | 'notes')
      setColW(section.layout?.w ?? 3)
    } else {
      // Reset form saat tambah baru
      setTitle(''); setIcon('📁'); setSubtitle('')
      setAccent(ACCENT_COLORS[0]); setType('section')
      setWidgetType('clock'); setColW(3)
    }
  }, [section, open])

  // Simpan section (tambah atau update)
  const handleSave = () => {
    if (!title.trim()) { toast('Judul section tidak boleh kosong.', 'error'); return }

    if (section) {
      // Mode edit — update section yang sudah ada
      updatePersonalSection(section.id, {
        title:      title.trim(),
        icon:       icon.trim(),
        subtitle:   subtitle.trim(),
        accentColor: accent || undefined,
        layout:     { ...section.layout, w: colW },
        type,
        widgetType: type === 'widget' ? widgetType : undefined,
      })
      toast('Section diperbarui.', 'success')
    } else {
      // Mode tambah — buat section baru
      addPersonalSection({
        title:      title.trim(),
        icon:       icon.trim(),
        subtitle:   subtitle.trim(),
        accentColor: accent || undefined,
        layout:     { x: 0, y: 0, w: colW, h: 5 },
        type,
        widgetType: type === 'widget' ? widgetType : undefined,
      })
      toast('Section ditambahkan.', 'success')
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      title={section ? `Edit: ${section.title}` : 'Tambah Section Baru'}
      onClose={onClose}
      footer={
        <>
          <button className="btn-cancel" onClick={onClose}>Batal</button>
          <button className="btn-save" onClick={handleSave}>
            {section ? 'Simpan' : 'Tambahkan'}
          </button>
        </>
      }
    >
      {/* Judul section */}
      <div className="field">
        <label>Judul</label>
        <input
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Nama section..." autoFocus
        />
      </div>

      {/* Icon emoji */}
      <div className="field">
        <label>Icon (emoji)</label>
        <input
          value={icon} onChange={e => setIcon(e.target.value)}
          placeholder="📁" maxLength={4}
          style={{ fontSize: 20, width: 80 }}
        />
      </div>

      {/* Subtitle / deskripsi */}
      <div className="field">
        <label>Subtitle (opsional)</label>
        <input
          value={subtitle} onChange={e => setSubtitle(e.target.value)}
          placeholder="Deskripsi singkat..."
        />
      </div>

      {/* Tipe section — hanya saat tambah baru */}
      {!section && (
        <div className="field">
          <label>Tipe</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['section', 'widget'] as const).map(t => (
              <button key={t} onClick={() => setType(t)} style={{
                flex: 1, padding: '8px', fontSize: 12, fontWeight: 600,
                background: type === t ? 'var(--mint-bg2)' : 'var(--bg3)',
                border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border2)'}`,
                borderRadius: 6, color: type === t ? 'var(--accent)' : 'var(--silver3)',
                cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
              }}>{t === 'section' ? '📁 Section' : '🧩 Widget'}</button>
            ))}
          </div>
        </div>
      )}

      {/* Pilih tipe widget — hanya jika tipe = widget */}
      {type === 'widget' && !section && (
        <div className="field">
          <label>Tipe Widget</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['clock', 'notes'] as const).map(w => (
              <button key={w} onClick={() => setWidgetType(w)} style={{
                flex: 1, padding: '8px', fontSize: 12, fontWeight: 600,
                background: widgetType === w ? 'var(--mint-bg2)' : 'var(--bg3)',
                border: `1px solid ${widgetType === w ? 'var(--accent)' : 'var(--border2)'}`,
                borderRadius: 6, color: widgetType === w ? 'var(--accent)' : 'var(--silver3)',
                cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
              }}>{w === 'clock' ? '🕐 Jam' : '📝 Catatan'}</button>
            ))}
          </div>
        </div>
      )}

      {/* Warna aksen border section */}
      <div className="field">
        <label>Warna Aksen</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ACCENT_COLORS.map(c => (
            <div key={c} onClick={() => setAccent(c)} style={{
              width: 28, height: 28, borderRadius: 6, background: c,
              cursor: 'pointer', transition: 'all .15s',
              border: `2px solid ${accent === c ? 'white' : 'transparent'}`,
              boxShadow: accent === c ? `0 0 8px ${c}` : 'none',
            }} />
          ))}
          {/* Tombol hapus warna aksen */}
          <div onClick={() => setAccent('')} style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--bg3)', border: `1px solid ${!accent ? 'var(--accent)' : 'var(--border2)'}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 12, color: 'var(--silver3)',
          }}>✕</div>
        </div>
      </div>

      {/* Info: section pribadi hanya untuk diri sendiri */}
      <div style={{
        fontSize: 11, color: 'var(--silver3)', padding: '10px 12px',
        background: 'var(--bg3)', borderRadius: 6, lineHeight: 1.5,
      }}>
        💡 Section ini hanya tampil di dashboard kamu. Untuk membuat section yang
        bisa dilihat user lain, gunakan fitur Shared Section (admin only).
      </div>
    </Modal>
  )
}
