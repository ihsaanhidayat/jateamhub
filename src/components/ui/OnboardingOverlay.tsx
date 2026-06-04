import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'

interface Props {
  onDismiss:   () => void
  onStartEdit: () => void
}

export default function OnboardingOverlay({ onDismiss, onStartEdit }: Props) {
  const { profile } = useAuthStore()
  const name = profile?.full_name?.split(' ')[0] || profile?.username || 'Kamu'
  const [page, setPage] = useState(0)

  const pages = [
    {
      emoji: '👋',
      title: `Selamat datang, ${name}!`,
      desc: `Senang bertemu denganmu. Kamu baru saja masuk ke JateamHub — workspace digital tim kita. Mari kita kenalkan sebentar sebelum kamu mulai bekerja.`,
      action: null,
    },
    {
      emoji: '🏢',
      title: 'JateamHub sebagai Workspace',
      desc: `JateamHub adalah portal kerja terpusat untuk seluruh tim. Semua link penting, alat kerja, catatan, dan tugas harian tersedia di satu tempat — mudah diakses kapan saja, di mana saja.`,
      action: null,
    },
    {
      emoji: '✨',
      title: 'Fitur-fitur Utama',
      items: [
        { icon: '📁', text: 'Section — kelompokkan link berdasarkan topik atau divisi' },
        { icon: '📝', text: 'Notes — catatan pribadi dengan pengamanan password' },
        { icon: '📋', text: 'Todo List — kelola tugas harian dengan pengingat otomatis' },
        { icon: '🔍', text: 'Search — temukan link di seluruh dashboard dengan cepat (Ctrl+K)' },
        { icon: '🌙', text: 'Dark Mode — sesuaikan tampilan dengan preferensimu' },
      ],
      action: null,
    },
    {
      emoji: '📁',
      title: 'Apa itu Section?',
      desc: `Section adalah kumpulan link yang dikelompokkan berdasarkan tema. Misalnya: "Aplikasi Klaim", "Portal HR", atau "Tools Tim". Kamu bisa membuat section pribadi dan menyesuaikan isinya sendiri.`,
      action: null,
    },
    {
      emoji: '🔗',
      title: 'Cara Tambah Link',
      items: [
        { icon: '1️⃣', text: 'Klik tombol ✏️ (Edit Mode) di pojok kanan atas header' },
        { icon: '2️⃣', text: 'Klik tombol ＋ pada section yang ingin ditambah link-nya' },
        { icon: '3️⃣', text: 'Isi Nama, URL, dan ikon link-nya' },
        { icon: '4️⃣', text: 'Klik Simpan — link langsung muncul di section' },
        { icon: '💡', text: 'Kamu juga bisa Import banyak link sekaligus via tombol 📥' },
      ],
      action: { label: '✏️ Coba Sekarang', fn: () => { onDismiss(); onStartEdit() } },
    },
    {
      emoji: '🚀',
      title: `Selamat Bekerja, ${name}!`,
      desc: `Dashboard-mu sudah siap. Mulai dengan menambahkan link-link yang sering kamu gunakan. Jika butuh bantuan, semua fitur bisa kamu eksplorasi sendiri.\n\nSelamat berkarya! 💪`,
      action: { label: 'Mulai Sekarang!', fn: onDismiss },
    },
  ]

  const p = pages[page]
  const isLast = page === pages.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'fadeIn 350ms var(--ease)',
    }}>
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        borderRadius: 22, width: '100%', maxWidth: 520,
        overflow: 'hidden', boxShadow: '0 32px 100px rgba(0,0,0,0.4)',
        animation: 'scaleIn 350ms var(--ease)',
      }}>
        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--border)' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, var(--accent), #7C3AED)',
            width: `${((page + 1) / pages.length) * 100}%`,
            transition: 'width 400ms ease',
          }} />
        </div>

        {/* Content */}
        <div style={{ padding: '36px 40px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>{p.emoji}</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--silver)', letterSpacing: '-0.5px', margin: '0 0 14px' }}>
            {p.title}
          </h2>

          {(p as any).desc && (
            <p style={{ fontSize: 14, color: 'var(--silver3)', lineHeight: 1.7, margin: '0 0 8px', whiteSpace: 'pre-line' }}>
              {(p as any).desc}
            </p>
          )}

          {(p as any).items && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', margin: '8px 0' }}>
              {(p as any).items.map((item: any, i: number) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'var(--bg4)', border: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--silver2)', lineHeight: 1.5 }}>{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{
          padding: '0 40px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          {/* Dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {pages.map((_, i) => (
              <div key={i} onClick={() => setPage(i)} style={{
                width: i === page ? 20 : 8, height: 8, borderRadius: 4,
                background: i === page ? 'var(--accent)' : 'var(--border2)',
                cursor: 'pointer', transition: 'all 300ms',
              }} />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            {page > 0 && (
              <button onClick={() => setPage(p => p - 1)} style={{
                height: 40, padding: '0 18px', background: 'none',
                border: '1px solid var(--border2)', borderRadius: 10,
                color: 'var(--silver3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>← Kembali</button>
            )}
            {page === 0 && (
              <button onClick={onDismiss} style={{
                height: 40, padding: '0 16px', background: 'none',
                border: '1px solid var(--border2)', borderRadius: 10,
                color: 'var(--silver4)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>Lewati</button>
            )}
            {p.action ? (
              <button onClick={p.action.fn} style={{
                height: 40, padding: '0 22px',
                background: 'linear-gradient(135deg, var(--accent), #7C3AED)',
                border: 'none', borderRadius: 10,
                color: 'white', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}>{p.action.label}</button>
            ) : (
              <button onClick={() => setPage(p => p + 1)} style={{
                height: 40, padding: '0 22px',
                background: 'linear-gradient(135deg, var(--accent), #7C3AED)',
                border: 'none', borderRadius: 10,
                color: 'white', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}>Lanjut →</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
