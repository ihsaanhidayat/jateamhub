import { useEffect, useState } from 'react'
import { loadCoffeeUrl } from '../../utils/supabaseClient'

interface Props { onClose: () => void }

export default function CoffeeModal({ onClose }: Props) {
  const [coffeeUrl, setCoffeeUrl] = useState('')

  useEffect(() => {
    loadCoffeeUrl().then(url => setCoffeeUrl(url))
  }, [])

  // Warna hardcode light — tidak mengikuti tema user
  const C = {
    bg:      '#FFFFFF',
    bg2:     '#F8FAFC',
    border:  'rgba(15,23,42,0.1)',
    text:    '#0F172A',
    text2:   '#64748B',
    accent:  '#0EA5E9',
    accentBg:'rgba(14,165,233,0.08)',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
      padding: 20, animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.bg, border: `1px solid ${C.border}`,
        borderRadius: 16, width: '100%', maxWidth: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        overflow: 'hidden', fontFamily: "'Space Grotesk', sans-serif",
      }}>
        {/* Top accent */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${C.accent}, transparent)` }} />

        <div style={{ padding: '28px 28px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>☕</div>
          </div>

          <h2 style={{
            fontSize: 18, fontWeight: 700, color: C.text,
            textAlign: 'center', marginBottom: 10, letterSpacing: '-0.3px',
          }}>Halo, Selamat datang! 👋</h2>
          <p style={{
            fontSize: 13, color: C.text2, textAlign: 'center',
            lineHeight: 1.7, marginBottom: 24,
          }}>
            JateamHub dibuat dengan sepenuh hati untuk membantu produktivitas kerja tim.
            Kalau aplikasi ini membantu, traktir developer-nya kopi yuk ☕
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {coffeeUrl && (
              <a href={coffeeUrl} target="_blank" rel="noopener noreferrer"
                onClick={onClose}
                style={{
                  display: 'block', width: '100%', padding: '12px',
                  background: C.accentBg, border: `1px solid ${C.accent}`,
                  borderRadius: 8, color: C.accent, fontSize: 14, fontWeight: 700,
                  textAlign: 'center', cursor: 'pointer',
                  fontFamily: "'Space Grotesk', sans-serif", textDecoration: 'none',
                }}>
                ☕ Traktir Kopi
              </a>
            )}
            <button onClick={onClose} style={{
              width: '100%', padding: '10px',
              background: C.bg2, border: `1px solid ${C.border}`,
              borderRadius: 8, color: C.text2, fontSize: 13,
              cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
            }}>
              {coffeeUrl ? 'Nanti Saja' : 'Tutup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
