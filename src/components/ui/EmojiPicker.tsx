import { useState, useEffect, useRef } from 'react'

const CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: '⭐ Umum', emojis: ['📋','📁','🔗','⭐','❤️','🎯','🔥','✅','📌','💡','🏠','⚡','🎨','🔒','📝','🗂️','📊','📈','🛠️','💼'] },
  { label: '👤 Orang', emojis: ['👤','👥','🧑‍💼','👨‍💻','👩‍💻','🤝','💬','📞','📧','🏢','🧑‍🏫','👨‍⚕️','🧑‍🔬','👷','🧑‍🍳'] },
  { label: '📊 Kerja', emojis: ['📊','📈','📉','💰','💳','🏦','📑','📃','📄','🗓️','⏰','🔔','📮','✉️','📎'] },
  { label: '🎮 Fun', emojis: ['🎮','🎵','🎬','📸','🎭','🏆','🎪','🎲','🧩','🎯','⚽','🏀','🎾','🏊','🚀'] },
  { label: '🍔 Food', emojis: ['🍔','☕','🍕','🍱','🍜','🍣','🥗','🍰','🧋','🍺','🫖','🥤','🍎','🥑','🌮'] },
  { label: '🌍 Travel', emojis: ['🌍','✈️','🚗','🏖️','⛰️','🗺️','🏨','🚂','🚢','🎒','🌅','🏕️','🗼','🎡','🌸'] },
]

interface Props {
  value: string
  onChange: (emoji: string) => void
  onClose: () => void
}

export default function EmojiPicker({ value, onChange, onClose }: Props) {
  const [cat, setCat] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click + Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
      background: 'var(--card-bg)', border: '1px solid var(--border2)',
      borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
      width: 260, overflow: 'hidden',
      animation: 'slideDown 150ms ease',
    }}>
      {/* Category tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {CATEGORIES.map((c, i) => (
          <button key={i} onClick={() => setCat(i)} style={{
            padding: '6px 8px', background: cat === i ? 'var(--accent-light)' : 'none',
            border: 'none', borderBottom: cat === i ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0,
          }}>{c.label.split(' ')[0]}</button>
        ))}
      </div>
      {/* Emoji grid */}
      <div style={{ padding: 8, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, maxHeight: 180, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {CATEGORIES[cat].emojis.map(e => (
          <button key={e} onClick={() => { onChange(e); onClose() }} style={{
            width: 32, height: 32, borderRadius: 6,
            background: value === e ? 'var(--accent-light)' : 'none',
            border: value === e ? '1px solid var(--accent)' : '1px solid transparent',
            cursor: 'pointer', fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 100ms',
          }}
            onMouseEnter={e2 => { (e2.target as HTMLElement).style.background = 'var(--bg4)' }}
            onMouseLeave={e2 => { (e2.target as HTMLElement).style.background = value === e ? 'var(--accent-light)' : 'none' }}
          >{e}</button>
        ))}
      </div>
    </div>
  )
}
