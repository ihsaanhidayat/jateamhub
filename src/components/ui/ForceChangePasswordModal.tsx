// ForceChangePasswordModal — shown when admin resets a user's password
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
    if (newPw !== confirmPw) return setErr('Konfirmasi tidak cocok.')
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
    width: '100%', height: 44, background: 'var(--bg4)',
    border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
    padding: '0 44px 0 14px', color: 'var(--silver)', fontSize: 14,
    fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font)' }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border2)', borderRadius: 16, width: '100%', maxWidth: 380, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--silver)' }}>Buat password baru</div>
          <div style={{ fontSize: 12, color: 'var(--silver4)', marginTop: 4 }}>
            Password kamu telah direset oleh admin. Buat password baru untuk melanjutkan.
          </div>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => { setNewPw(e.target.value); setErr('') }}
              placeholder="Password baru (min. 6 karakter)"
              autoFocus
              style={inputSt}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)', fontSize: 14,
            }}>{showPw ? '🙈' : '👁'}</button>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setErr('') }}
              placeholder="Konfirmasi password baru"
              style={inputSt}
            />
          </div>
          {err && (
            <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: 'color-mix(in srgb, var(--red) 8%, transparent)', borderRadius: 8 }}>
              {err}
            </div>
          )}
          <button
            onClick={handleChange}
            disabled={loading || !newPw || !confirmPw}
            style={{ height: 44, background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', opacity: (loading || !newPw || !confirmPw) ? 0.55 : 1 }}
          >
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button
            onClick={logout}
            style={{ height: 38, background: 'none', border: 'none', color: 'var(--silver4)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
