import { useState, useEffect, useRef } from 'react'
import { EMOJI_CATEGORIES } from './emojiData'

interface Props {
  onPick:  (emoji: string) => void
  onClose: () => void
}

export default function EmojiPicker({ onPick, onClose }: Props) {
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].id)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    // Delay to avoid catching the same click that opened the picker
    const t = setTimeout(() => document.addEventListener('mousedown', onDoc), 0)
    window.addEventListener('keydown', onEsc)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onEsc) }
  }, [onClose])

  const active = EMOJI_CATEGORIES.find(c => c.id === cat) ?? EMOJI_CATEGORIES[0]

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
        width: 'min(340px, calc(100vw - 32px))', height: 300,
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 14, boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        zIndex: 60, animation: 'fadeUp 140ms ease',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 2, padding: '6px 6px 4px',
        borderBottom: '1px solid var(--border)', overflowX: 'auto',
      }}>
        {EMOJI_CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            title={c.label}
            style={{
              flexShrink: 0, width: 34, height: 32, fontSize: 17,
              background: c.id === cat ? 'var(--accent-light)' : 'none',
              border: 'none', borderRadius: 8, cursor: 'pointer',
              opacity: c.id === cat ? 1 : 0.6, transition: 'all 120ms',
            }}
          >{c.icon}</button>
        ))}
      </div>

      {/* Emoji grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 8,
        display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2,
        alignContent: 'start',
      }}>
        {active.emojis.map((e, i) => (
          <button
            key={e + i}
            onClick={() => onPick(e)}
            style={{
              fontSize: 22, lineHeight: 1, height: 34,
              background: 'none', border: 'none', borderRadius: 8,
              cursor: 'pointer', transition: 'background 80ms',
            }}
            onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
            onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = 'none'}
          >{e}</button>
        ))}
      </div>
    </div>
  )
}
