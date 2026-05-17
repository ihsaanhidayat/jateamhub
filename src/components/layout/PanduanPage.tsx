import { useStore } from '../../store/dashboardStore'
import GridLayout from './GridLayout'

const HARDCODED = [
  {
    icon: '🏠',
    title: 'Beranda',
    content: 'Beranda adalah halaman utama JateamHub. Di sini kamu bisa mengakses semua link dan tools yang dibutuhkan sesuai unit kerjamu. Section yang tampil disesuaikan otomatis berdasarkan unit — PRO, CRO, atau Klaim.',
  },
  {
    icon: '✏️',
    title: 'Edit Mode',
    content: 'Klik tombol pensil (✏️) di pojok kanan atas untuk masuk Edit Mode. Dalam mode ini kamu bisa menambah section, menambah link, menggeser posisi section, dan mengubah ukurannya. Setiap perubahan tersimpan otomatis ke database.',
  },
  {
    icon: '📁',
    title: 'Section & Link',
    content: 'Section adalah kelompok link. Setiap section bisa berisi banyak link. Kamu bisa mengatur tampilan link dalam berbagai format: Button, List, Icon+Text, atau Folder Grid. Pilih yang paling nyaman untuk produktivitasmu.',
  },
  {
    icon: '👤',
    title: 'Profil & Akun',
    content: 'Klik ikon profil di pojok kanan atas untuk mengakses halaman profil. Di sini kamu bisa mengganti avatar emoji, mengubah password, dan melakukan Sign Out. Admin juga bisa mengelola semua user dari halaman ini.',
  },
  {
    icon: '⚙️',
    title: 'Pengaturan Tampilan',
    content: 'Klik ikon ⚙️ untuk membuka panel Options. Kamu bisa mengubah tampilan item (Button, List, Folder Grid), ukuran icon, dan berbagai pengaturan lain. Pengaturan tersimpan per akun sehingga konsisten di semua device.',
  },
  {
    icon: '🔍',
    title: 'Filter & Pencarian',
    content: 'Gunakan kolom Filter di header untuk mencari link secara cepat. Ketik nama aplikasi atau kata kunci — section dan item yang tidak relevan akan otomatis diredup.',
  },
  {
    icon: '🕐',
    title: 'Widget Jam & Catatan',
    content: 'Admin bisa menambahkan widget Jam Digital dan Catatan di dashboard. Widget Jam menampilkan waktu real-time. Widget Catatan tersimpan per browser — cocok untuk catatan cepat saat bekerja.',
  },
  {
    icon: '👥',
    title: 'Unit Kerja',
    content: 'JateamHub mendukung tiga unit kerja: PRO, CRO, dan Klaim. Setiap unit mendapat konten yang berbeda di beranda. Admin bisa mengatur section mana yang tampil untuk unit mana melalui Edit Mode.',
  },
  {
    icon: '💾',
    title: 'Penyimpanan Data',
    content: 'Semua perubahan tersimpan otomatis ke database dan sinkron ke semua device. Jika terjadi gangguan koneksi, status "Belum tersimpan" akan muncul di edit bar — klik untuk menyimpan ulang secara manual.',
  },
  {
    icon: '🆘',
    title: 'Butuh Bantuan?',
    content: 'Jika menemukan masalah atau butuh akses, hubungi Admin melalui halaman Support. Admin dapat menambahkan akun baru, mengatur permission, dan membantu konfigurasi dashboard sesuai kebutuhan.',
  },
]

export default function PanduanPage() {
  const { personalSections } = useStore()
  const hasSections = personalSections.some(s => (s.pageId ?? 'beranda') === 'panduan')

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {hasSections ? (
        <GridLayout onAddSection={() => {}} />
      ) : (
        <div style={{ padding: '24px 20px', maxWidth: 800, margin: '0 auto' }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{
              fontSize: 22, fontWeight: 700, color: 'var(--accent)',
              letterSpacing: '-0.5px', marginBottom: 6,
              textShadow: '0 0 20px var(--accent-glow)',
            }}>📖 Panduan JateamHub</h2>
            <p style={{ fontSize: 13, color: 'var(--silver3)', lineHeight: 1.6 }}>
              Panduan penggunaan portal link internal Jateam. Baca sekilas untuk memaksimalkan produktivitas kerja.
            </p>
            <div style={{ width: 60, height: 2, background: 'linear-gradient(90deg, var(--accent), transparent)', marginTop: 12, borderRadius: 1 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {HARDCODED.map((item, i) => (
              <div key={i} style={{
                background: 'rgba(14,14,14,0.95)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '18px 20px',
                transition: 'border-color .2s, box-shadow .2s',
                animation: `fadeSlideUp 0.3s ease ${i * 0.04}s both`,
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--mint-bg)'
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--silver)', letterSpacing: '0.2px' }}>{item.title}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--silver3)', lineHeight: 1.7, margin: 0 }}>{item.content}</p>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 32, padding: '16px 20px',
            background: 'var(--mint-bg)',
            border: '1px solid var(--mint-bg)',
            borderRadius: 10, fontSize: 12, color: 'var(--silver3)', lineHeight: 1.6,
          }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>💡 Tips Admin:</span> Kamu bisa menambahkan konten panduan sendiri dengan masuk Edit Mode dan menambah section di halaman ini. Section custom akan menggantikan panduan default ini.
          </div>
        </div>
      )}
    </div>
  )
}
