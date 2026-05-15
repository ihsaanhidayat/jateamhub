import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { useStore } from '../../store/dashboardStore'
import type { Section } from '../../types'
import { SECTION_DEFAULT_W } from '../../types'

interface Props { open: boolean; section: Section | null; onClose: () => void }

const ACCENT_PRESETS = ['#00FFC2','#00BFFF','#FF6B6B','#FFD93D','#C77DFF','#FF9F40','#6BCB77','#FF6BD6']
const UNIT_OPTIONS   = [
  { value: 'pro',   label: 'PRO',   color: '#C77DFF' },
  { value: 'cro',   label: 'CRO',   color: '#FF9F40' },
  { value: 'klaim', label: 'Klaim', color: '#FF6B6B' },
]

export default function SectionModal({ open, section, onClose }: Props) {
  const { addSection, updateSection, deleteSection, updateSectionLayout, toast, config, currentPage } = useStore()
  const [title,       setTitle]       = useState('')
  const [subtitle,    setSubtitle]    = useState('')
  const [icon,        setIcon]        = useState('')
  const [colW,        setColW]        = useState(SECTION_DEFAULT_W)
  const [accent,      setAccent]      = useState('')
  const [pageId,      setPageId]      = useState('beranda')
  const [visibility,  setVisibility]  = useState<'all' | 'admin' | 'unit'>('all')
  const [targetUnits, setTargetUnits] = useState<string[]>([])
  const [sectionType, setSectionType] = useState<'section' | 'widget'>('section')
  const [widgetType,  setWidgetType]  = useState<'clock' | 'notes'>('clock')

  useEffect(() => {
    if (open) {
      setTitle(section?.title ?? '')
      setSubtitle(section?.subtitle ?? '')
      setIcon(section?.icon ?? '')
      setColW(section?.layout?.w ?? SECTION_DEFAULT_W)
      setAccent(section?.accentColor ?? '')
      setPageId(section?.pageId ?? currentPage)
      setVisibility(section?.visibility ?? 'all')
      setTargetUnits(section?.targetUnits ?? [])
      setSectionType(section?.type ?? 'section')
      setWidgetType(section?.widgetType ?? 'clock')
    }
  }, [open, section, currentPage])

  const toggleUnit = (unit: string) =>
    setTargetUnits(prev => prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit])

  const handleSave = () => {
    if (!title.trim()) { toast('Judul wajib diisi.', 'error'); return }
    if (section) {
      updateSection(section.id, title.trim(), icon.trim(), subtitle.trim(), colW * 70, accent || undefined, pageId, visibility, targetUnits)
      updateSectionLayout(section.id, { ...section.layout, w: colW })
      toast('Section diperbarui.', 'success')
    } else {
      addSection(title.trim(), icon.trim(), subtitle.trim(), accent || undefined, visibility, targetUnits, pageId, sectionType, sectionType === 'widget' ? widgetType : undefined)
      toast('Section ditambahkan.', 'success')
    }
    onClose()
  }

  const handleDelete = () => {
    if (!section) return
    if (!confirm('Hapus section ini beserta semua item di dalamnya?')) return
    deleteSection(section.id); toast('Section dihapus.', 'success'); onClose()
  }

  const pages = config.pages ?? []

  return (
    <Modal open={open} title={section ? 'Edit Section' : 'Tambah Section'} onClose={onClose}
      footer={
        <>
          {section && <button className="btn-delete" onClick={handleDelete}>🗑 Hapus</button>}
          <button className="btn-cancel" onClick={onClose}>Batal</button>
          <button className="btn-save" onClick={handleSave}>Simpan</button>
        </>
      }
    >
      {/* Tipe — hanya di add mode */}
      {!section && (
        <div className="field">
          <label>Tipe</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['section', 'widget'] as const).map(t => (
              <button key={t} onClick={() => setSectionType(t)} style={{
                flex: 1, padding: '8px', fontSize: 12, fontWeight: 600,
                background: sectionType === t ? 'var(--mint-bg2)' : 'var(--bg3)',
                border: `1px solid ${sectionType === t ? 'var(--mint)' : 'var(--border2)'}`,
                borderRadius: 'var(--radius-sm)', color: sectionType === t ? 'var(--mint)' : 'var(--silver3)',
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}>
                {t === 'section' ? '📋 Section' : '🧩 Widget'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Widget type selector */}
      {sectionType === 'widget' && !section && (
        <div className="field">
          <label>Jenis Widget</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['clock', '🕐 Digital Clock'], ['notes', '📝 Notes']] as const).map(([wt, label]) => (
              <button key={wt} onClick={() => setWidgetType(wt)} style={{
                flex: 1, padding: '8px', fontSize: 12, fontWeight: 600,
                background: widgetType === wt ? 'var(--mint-bg2)' : 'var(--bg3)',
                border: `1px solid ${widgetType === wt ? 'var(--mint)' : 'var(--border2)'}`,
                borderRadius: 'var(--radius-sm)', color: widgetType === wt ? 'var(--mint)' : 'var(--silver3)',
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder={sectionType === 'widget' ? 'e.g. Jam Digital' : 'e.g. Layanan Bersama'} autoFocus />
      </div>
      <div className="field">
        <label>Subtitle (opsional)</label>
        <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Keterangan singkat" />
      </div>

      {sectionType === 'section' && (
        <div className="field">
          <label>Icon (emoji atau URL)</label>
          <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🔧 atau https://..." />
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label>Halaman</label>
          <select value={pageId} onChange={e => setPageId(e.target.value)}>
            {pages.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Lebar (kolom)</label>
          <select value={colW} onChange={e => setColW(Number(e.target.value))}>
            <option value={2}>2 — Narrow</option>
            <option value={3}>3 — Slim</option>
            <option value={4}>4 — Normal</option>
            <option value={5}>5</option>
            <option value={6}>6 — Half</option>
            <option value={8}>8 — Wide</option>
            <option value={12}>12 — Full</option>
          </select>
        </div>
      </div>

      {/* Visibility */}
      <div className="field">
        <label>Visibility / Target</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {([
            ['all',   '🌐 Semua User',   'var(--mint)'],
            ['admin', '🔒 Admin Only',   '#00BFFF'],
            ['unit',  '🎯 Unit Tertentu','#C77DFF'],
          ] as const).map(([v, label, color]) => (
            <button key={v} onClick={() => setVisibility(v)} style={{
              flex: 1, padding: '7px 4px', fontSize: 11, fontWeight: 600,
              background: visibility === v ? color + '22' : 'var(--bg3)',
              border: `1px solid ${visibility === v ? color : 'var(--border2)'}`,
              borderRadius: 'var(--radius-sm)', color: visibility === v ? color : 'var(--silver3)',
              cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
            }}>{label}</button>
          ))}
        </div>

        {/* Target units — muncul kalau visibility=unit */}
        {visibility === 'unit' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {UNIT_OPTIONS.map(u => {
              const active = targetUnits.includes(u.value)
              return (
                <div key={u.value} onClick={() => toggleUnit(u.value)} style={{
                  padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${active ? u.color : 'var(--border2)'}`,
                  background: active ? u.color + '22' : 'var(--bg3)',
                  color: active ? u.color : 'var(--silver3)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  transition: 'all .15s', userSelect: 'none',
                  textTransform: 'uppercase', letterSpacing: '.5px', fontFamily: 'var(--mono)',
                }}>
                  {active ? '✓ ' : ''}{u.label}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Accent */}
      <div className="field">
        <label>Accent Color</label>
        <div className="color-swatches">
          <div className={`color-swatch clear${!accent ? ' selected' : ''}`} onClick={() => setAccent('')} title="Default">✕</div>
          {ACCENT_PRESETS.map(c => (
            <div key={c} className={`color-swatch${accent === c ? ' selected' : ''}`}
              style={{ background: c }} onClick={() => setAccent(c)} />
          ))}
        </div>
        {accent && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
              style={{ width: 32, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
            <span style={{ fontSize: 11, color: 'var(--silver3)', fontFamily: 'var(--mono)' }}>{accent}</span>
          </div>
        )}
      </div>

      {/* Preview */}
      <div style={{
        background: 'var(--bg3)', borderRadius: 'var(--radius-sm)',
        padding: '8px 12px', borderLeft: `3px solid ${accent || 'var(--mint)'}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>{icon || (sectionType === 'widget' ? '🧩' : '📁')}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '.8px' }}>
            {title || 'Preview'}
          </div>
          {subtitle && <div style={{ fontSize: 10, color: 'var(--silver3)' }}>{subtitle}</div>}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 9, color: visibility === 'all' ? 'var(--mint)' : visibility === 'admin' ? '#00BFFF' : '#C77DFF', fontFamily: 'var(--mono)', fontWeight: 700, textTransform: 'uppercase' }}>
          {visibility === 'all' ? 'ALL' : visibility === 'admin' ? 'ADM' : `UNIT(${targetUnits.length})`}
        </div>
      </div>
    </Modal>
  )
}
