import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { isAdminGlobal } from '../../utils/roles'

const PANDUAN = [
  { icon: '🏠', title: 'Beranda', content: 'Halaman utama JateamHub. Semua link dan tools yang kamu butuhkan sesuai unit kerja tampil di sini. Section disesuaikan otomatis berdasarkan unitmu.' },
  { icon: '✏️', title: 'Edit Mode', content: 'Klik tombol pensil (✏️) di header untuk masuk Edit Mode. Tambah section, tambah link, geser posisi, ubah ukuran. Perubahan tersimpan otomatis ke database.' },
  { icon: '📁', title: 'Section & Link', content: 'Section adalah kelompok link. Atur tampilan link: Button, List, Icon+Text, atau Folder Grid. Pilih format yang paling nyaman untukmu.' },
  { icon: '⚙️', title: 'Pengaturan', content: 'Klik ⚙️ untuk membuka panel Options. Ubah tampilan item, ukuran icon, dan pengaturan lain. Tersimpan per akun — konsisten di semua device.' },
  { icon: '🔍', title: 'Filter Cepat', content: 'Gunakan kolom Filter di header untuk mencari link. Ketik nama aplikasi — section yang tidak relevan otomatis diredup.' },
  { icon: '👤', title: 'Profil Akun', content: 'Klik foto profilmu di header untuk mengakses halaman profil. Ganti foto, lihat info akun, dan Sign Out dari sini.' },
  { icon: '🕐', title: 'Widget Jam & Catatan', content: 'Widget Jam menampilkan waktu real-time. Widget Catatan untuk catatan cepat. Keduanya bisa ditambahkan admin di dashboard.' },
  { icon: '💾', title: 'Data Tersimpan', content: 'Perubahan tersimpan otomatis ke database dan sinkron ke semua device. Status "Menyimpan..." muncul di edit bar saat proses berlangsung.' },
  { icon: '🆘', title: 'Butuh Bantuan?', content: 'Temui kendala atau butuh akses baru? Hubungi Admin atau Superadmin untuk mendapatkan bantuan.' },
]

export default function PanduanFAB() {
  const [open, setOpen] = useState(false)
  const { profile } = useAuthStore()
  // FAB hanya muncul untuk admin global
  if (!isAdminGlobal(profile as any)) return null

  return (
    <>
      <button className="panduan-fab" onClick={() => setOpen(true)} title="Panduan Penggunaan">
        ❓
      </button>

      {open && (
        <>
          <div style={{
            position: 'fixed', inset: 0, zIndex: 349,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
          }} onClick={() => setOpen(false)} />
          <div className="panduan-panel">
            {/* Header */}
            <div style={{
              padding: '18px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(0,255,194,0.03)', flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--mint)', textShadow: '0 0 12px rgba(0,255,194,0.3)' }}>
                  📖 Panduan JateamHub
                </div>
                <div style={{ fontSize: 11, color: 'var(--silver3)', marginTop: 2 }}>
                  Petunjuk penggunaan aplikasi
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{
                background: 'none', border: 'none', color: 'var(--silver3)',
                fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4,
              }}>×</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {PANDUAN.map((item, i) => (
                  <div key={i} style={{
                    background: 'rgba(14,14,14,0.95)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8, padding: '14px 16px',
                    animation: `fadeSlideUp 0.3s ease ${i * 0.03}s both`,
                    transition: 'border-color .2s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,255,194,0.12)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--silver)' }}>{item.title}</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--silver3)', lineHeight: 1.7, margin: 0 }}>{item.content}</p>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 16, padding: '14px 16px',
                background: 'rgba(0,255,194,0.04)', border: '1px solid rgba(0,255,194,0.12)',
                borderRadius: 8, fontSize: 11, color: 'var(--silver3)', lineHeight: 1.6,
              }}>
                <span style={{ color: 'var(--mint)', fontWeight: 700 }}>💡 Admin:</span>{' '}
                Kamu bisa menambahkan panduan sendiri di halaman Beranda dengan membuat section khusus panduan.
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
