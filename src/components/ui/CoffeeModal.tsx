import { useEffect, useState } from 'react'
import { loadCoffeeUrl } from '../../utils/supabaseClient'

interface Props { onClose: () => void }

export default function CoffeeModal({ onClose }: Props) {
  const [coffeeUrl, setCoffeeUrl] = useState('')

  useEffect(() => {
    loadCoffeeUrl().then(url => setCoffeeUrl(url))
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      padding: 20, animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div className="coffee-modal" onClick={e => e.stopPropagation()}>
        {/* Top accent */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--mint), transparent)' }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Icon */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>☕</div>
          </div>

          {/* Text */}
          <h2 style={{
            fontSize: 18, fontWeight: 700, color: 'var(--silver)',
            textAlign: 'center', marginBottom: 10, letterSpacing: '-0.3px',
          }}>Halo, Selamat datang! 👋</h2>
          <p style={{
            fontSize: 13, color: 'var(--silver3)', textAlign: 'center',
            lineHeight: 1.7, marginBottom: 24,
          }}>
            JateamHub dibuat dengan sepenuh hati untuk membantu produktivitas kerja tim.
            Kalau aplikasi ini membantu, traktir developer-nya kopi yuk ☕
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {coffeeUrl && (
              <a href={coffeeUrl} target="_blank" rel="noopener noreferrer"
                onClick={onClose}
                style={{
                  display: 'block', width: '100%', padding: '12px',
                  background: 'rgba(0,255,194,0.1)', border: '1px solid var(--mint)',
                  borderRadius: 8, color: 'var(--mint)', fontSize: 14, fontWeight: 700,
                  textAlign: 'center', cursor: 'pointer', transition: 'all .15s',
                  fontFamily: 'var(--font)', textDecoration: 'none',
                }}>
                ☕ Traktir Kopi
              </a>
            )}
            <button onClick={onClose} style={{
              width: '100%', padding: '10px',
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 8, color: 'var(--silver3)', fontSize: 13,
              cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font)',
            }}>
              {coffeeUrl ? 'Nanti Saja' : 'Tutup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
