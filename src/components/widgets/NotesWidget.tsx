import { useState, useEffect, useRef, memo } from 'react'
import { useStore } from '../../store/dashboardStore'

interface Props { sectionId: string }

// Plain auto-saving notes — no lock/PIN. Content lives in items[0].desc.
function NotesWidgetImpl({ sectionId }: Props) {
  const section  = useStore(s => s.personalSections.find(sec => sec.id === sectionId))
  const noteItem = section?.items?.[0]

  const [text,  setText]  = useState(noteItem?.desc ?? '')
  const [saved, setSaved] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const autoGrow = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }
  useEffect(() => { autoGrow() }, [text])

  // Re-sync when switching sections.
  useEffect(() => {
    const s = useStore.getState().personalSections.find(s => s.id === sectionId)
    setText(s?.items?.[0]?.desc ?? '')
  }, [sectionId])

  const handleChange = (val: string) => {
    setText(val); setSaved(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const store = useStore.getState()
      const s = store.personalSections.find(s => s.id === sectionId)
      if (!s) return
      const title = val.split('\n')[0]?.slice(0, 50) || 'Catatan'
      if (s.items.length > 0) {
        store.updateItem(sectionId, s.items[0].id, { ...s.items[0], desc: val, title })
      } else {
        store.addItem(sectionId, { title, url: '#', icon: '', desc: val, tags: [], newTab: false, useFavicon: false } as any)
      }
      store.syncPersonalToDb()
      setSaved(true)
    }, 600)
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg2)', position: 'relative' }}>
      {/* Status bar — sticky + fully opaque so the note never shows through it */}
      <div style={{
        padding: '4px 10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        fontSize: 9, fontFamily: 'var(--mono)', flexShrink: 0,
        position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg2)',
        boxShadow: '0 2px 8px -3px rgba(0,0,0,0.22)', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ color: saved ? 'var(--silver4)' : 'var(--accent)' }}>
          {saved ? '✓ tersimpan' : '● menyimpan...'}
        </span>
      </div>

      <textarea
        ref={textareaRef} value={text}
        onChange={e => { handleChange(e.target.value); autoGrow() }}
        placeholder="📝 Tulis catatan..."
        spellCheck={false}
        style={{
          width: '100%', background: 'transparent', border: 'none', outline: 'none',
          resize: 'none', color: 'var(--silver)', fontSize: 13, lineHeight: '28px',
          fontFamily: 'var(--font)', padding: '8px 12px',
          minHeight: 120, overflow: 'hidden',
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, color-mix(in srgb, var(--border) 35%, transparent) 27px, color-mix(in srgb, var(--border) 35%, transparent) 28px)',
          backgroundAttachment: 'local',
        }}
      />
    </div>
  )
}

export default memo(NotesWidgetImpl)
