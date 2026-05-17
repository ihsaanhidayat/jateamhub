import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/dashboardStore'

interface Props { sectionId: string }

export default function NotesWidget({ sectionId }: Props) {
  const { personalSections, updateItem, addItem, syncPersonalToDb } = useStore()

  // Catatan disimpan di item pertama section (desc field) → sync ke DB
  const section = personalSections.find(s => s.id === sectionId)
  const noteItem = section?.items?.[0]
  const [text, setText] = useState(noteItem?.desc ?? noteItem?.title ?? '')
  const [saved, setSaved] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync state saat section berubah dari DB
  useEffect(() => {
    const s = useStore.getState().personalSections.find(s => s.id === sectionId)
    const item = s?.items?.[0]
    setText(item?.desc ?? item?.title ?? '')
  }, [sectionId])

  const handleChange = (val: string) => {
    setText(val)
    setSaved(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const s = useStore.getState().personalSections.find(s => s.id === sectionId)
      if (!s) return
      if (s.items.length > 0) {
        // Update item pertama
        updateItem(sectionId, s.items[0].id, {
          ...s.items[0],
          desc: val,
          title: val.split('\n')[0]?.slice(0, 50) || 'Catatan',
        })
      } else {
        // Buat item baru sebagai container catatan
        addItem(sectionId, {
          title: val.split('\n')[0]?.slice(0, 50) || 'Catatan',
          url: '#', icon: '', desc: val,
          tags: [], newTab: false, useFavicon: false,
        })
      }
      await syncPersonalToDb()
      setSaved(true)
    }, 600)
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg2)',
    }}>
      <div style={{
        padding: '4px 12px',
        fontSize: 10,
        color: saved ? 'var(--silver3)' : 'var(--accent)',
        fontFamily: 'var(--mono)', letterSpacing: '.5px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0, transition: 'color .3s',
      }}>
        {saved ? '✓ tersimpan' : '● menyimpan...'}
      </div>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder="Tulis catatan di sini..."
        style={{
          flex: 1, width: '100%',
          background: 'transparent',
          border: 'none', outline: 'none', resize: 'none',
          color: 'var(--silver)', fontSize: 13, lineHeight: 1.6,
          fontFamily: 'var(--font)', padding: '10px 12px',
        }}
      />
    </div>
  )
}
