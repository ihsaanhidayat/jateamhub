// ─────────────────────────────────────────────────────────────
// OnboardingOverlay — panduan untuk user baru
// Muncul sekali saat dashboard kosong pertama kali
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'

interface Props {
  onDismiss:   () => void
  onStartEdit: () => void
}

const STEPS = [
  {
    icon: '✏️',
    title: 'Aktifkan Edit Mode',
    desc:  'Tap tombol ✏️ di header untuk masuk ke mode edit. Di sini kamu bisa menambah dan mengatur section.',
    highlight: 'edit-btn',
  },
  {
    icon: '📁',
    title: 'Tambah Section',
    desc:  'Tekan ＋ untuk menambah section baru. Section adalah folder berisi kumpulan link dan shortcut.',
    highlight: 'add-btn',
  },
  {
    icon: '🔗',
    title: 'Tambah Link',
    desc:  'Klik section untuk fokus, lalu tambahkan link ke dalam section. Drag icon untuk mengatur urutan.',
    highlight: 'section-card',
  },
  {
    icon: '⚙️',
    title: 'Atur Tampilan',
    desc:  'Buka ⚙️ Options untuk mengubah tema, tampilan item, dan ukuran icon sesuai preferensimu.',
    highlight: 'options-btn',
  },
]

export default function OnboardingOverlay({ onDismiss, onStartEdit }: Props) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'fadeIn 300ms var(--ease)',
    }}>
      <div style={{
        background: 'var(--bg3)',
        border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 400,
        overflow: 'hidden',
        animation: 'scaleIn 300ms var(--ease)',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--bg2)' }}>
          <div style={{
            height: '100%',
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: 'var(--accent)',
            transition: 'width 300ms var(--ease)',
          }} />
        </div>

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Icon + step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{
              width: 52, height: 52,
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>{current.icon}</div>
            <span style={{
              fontSize: 11, color: 'var(--silver3)',
              fontFamily: 'var(--mono)',
            }}>{step + 1} / {STEPS.length}</span>
          </div>

          {/* Content */}
          <h2 style={{
            fontSize: 18, fontWeight: 800,
            color: 'var(--silver)', marginBottom: 10,
            letterSpacing: '-0.3px',
          }}>{current.title}</h2>
          <p style={{
            fontSize: 13, color: 'var(--silver2)',
            lineHeight: 1.7, marginBottom: 24,
          }}>{current.desc}</p>

          {/* Step dots */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
            {STEPS.map((_, i) => (
              <div key={i} onClick={() => setStep(i)} style={{
                width: i === step ? 20 : 6, height: 6,
                borderRadius: 3,
                background: i === step ? 'var(--accent)' : 'var(--border2)',
                cursor: 'pointer',
                transition: 'all 300ms var(--ease)',
              }} />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDismiss} style={{
              flex: 1, height: 40,
              background: 'none',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--silver3)',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font)',
            }}>Lewati</button>

            {isLast ? (
              <button onClick={() => { onDismiss(); onStartEdit() }} style={{
                flex: 2, height: 40,
                background: 'var(--accent)', border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'white',
                fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}>🚀 Mulai Sekarang</button>
            ) : (
              <button onClick={() => setStep(s => s + 1)} style={{
                flex: 2, height: 40,
                background: 'var(--accent)', border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'white',
                fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}>Lanjut →</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
