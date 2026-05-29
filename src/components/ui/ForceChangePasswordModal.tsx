// ForceChangePasswordModal — muncul saat admin reset password user
// User wajib ganti password sebelum bisa akses dashboard
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../utils/supabaseClient'

export default function ForceChangePasswordModal() {
  const { profile, logout } = useAuthStore()
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [err,       setErr]       = useState('')
  const [loading,   setLoading]   = useState(false)

  const handleChange = async () => {
    if (!newPw || newPw.length < 6) return setErr('Password minimal 6 karakter.')
    if (newPw !== confirmPw) return setErr('Konfirmasi password tidak cocok.')
    setLoading(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('https://qsvrqdnyjywjzxkqwszl.supabase.co/functions/v1/update-user-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ userId: profile?.id, newPassword: newPw, forceChange: false })
      })
      const data = await res.json()
      if (!res.ok || data.error) { setErr(data.error ?? 'Gagal ganti password.'); setLoading(false); return }
      window.location.reload()
    } catch { setErr('Koneksi gagal. Coba lagi.') }
    setLoading(false)
  }

  const inputSt: React.CSSProperties = {
    width: '100%', height: 46, background: 'var(--bg2)',
    border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
    padding: '0 14px', color: 'var(--silver)', fontSize: 14,
    fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font)' }}>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 16, padding: '36px 32px', maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--silver)', margin: '0 0 8px' }}>Ganti Password</h2>
          <p style={{ fontSize: 13, color: 'var(--silver3)', margin: 0, lineHeight: 1.6 }}>
            Admin telah mereset password kamu.<br />Silakan buat password baru sebelum melanjutkan.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <input type={showPw ? 'text' : 'password'} value={newPw}
              onChange={e => { setNewPw(e.target.value); setErr('') }}
              placeholder="Password baru (min. 6 karakter)" autoFocus
              style={{ ...inputSt, paddingRight: 44 }} />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)', fontSize: 15 }}>{showPw ? '🙈' : '👁'}</button>
          </div>
          <input type={showPw ? 'text' : 'password'} value={confirmPw}
            onChange={e => { setConfirmPw(e.target.value); setErr('') }}
            placeholder="Konfirmasi password baru" style={inputSt} />
          {err && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: 'var(--red)', fontSize: 13 }}>{err}</div>}
          <button onClick={handleChange} disabled={loading || !newPw || !confirmPw}
            style={{ height: 46, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', opacity: (loading || !newPw || !confirmPw) ? 0.6 : 1 }}>
            {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
          </button>
          <button onClick={logout} style={{ height: 38, background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--silver3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>Logout</button>
        </div>
      </div>
    </div>
  )
}
