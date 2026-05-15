import { useState, useEffect, useRef } from 'react'

interface Props { sectionId: string }

export default function NotesWidget({ sectionId }: Props) {
  const storageKey = `jateamhub-notes-${sectionId}`
  const [text, setText]     = useState('')
  const [saved, setSaved]   = useState(true)
  const timerRef            = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) ?? ''
    setText(stored)
  }, [storageKey])

  const handleChange = (val: string) => {
    setText(val)
    setSaved(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      localStorage.setItem(storageKey, val)
      setSaved(true)
    }, 800)
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg2)',
    }}>
      {/* Status bar */}
      <div style={{
        padding: '4px 12px',
        fontSize: 10, color: saved ? 'var(--silver3)' : 'var(--mint)',
        fontFamily: 'var(--mono)', letterSpacing: '.5px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        transition: 'color .3s',
      }}>
        {saved ? '✓ tersimpan' : '● menyimpan...'}
      </div>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder="Tulis catatan di sini..."
        style={{
          flex: 1, width: '100%',
          background: 'transparent',
          border: 'none', outline: 'none', resize: 'none',
          color: 'var(--silver)', fontSize: 13, lineHeight: 1.6,
          fontFamily: 'var(--font)',
          padding: '10px 12px',
        }}
      />
    </div>
  )
}
