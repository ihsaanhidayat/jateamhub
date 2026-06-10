import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { supabase, signOut } from '../../utils/supabaseClient'
import { REGIONS, UNITS } from '../../types'

export default function GoogleOnboardingPage() {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [region,   setRegion]   = useState('sby')
  const [unit,     setUnit]     = useState('general')
  const [loading,  setLoading]  = useState(false)
  const [err,      setErr]      = useState('')

  // Pre-fill nama dari Google profile
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const meta = data.session?.user?.user_metadata
      if (meta?.full_name)    setFullName(meta.full_name)
      else if (meta?.name)    setFullName(meta.name)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) { setErr('Nama lengkap wajib diisi.'); return }
    if (!username.trim()) { setErr('Username wajib diisi.'); return }
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      setErr('Username 3–30 karakter: huruf kecil, angka, underscore.')
      return
    }
    setErr(''); setLoading(true)
    const error = await useAuthStore.getState().completeGoogleOnboarding(username, fullName, region, unit)
    setLoading(false)
    if (error) setErr(error)
  }

  const handleCancel = async () => {
    await signOut()
    useAuthStore.getState().logout()
  }

  const iSt: React.CSSProperties = {
    width: '100%', height: 40, padding: '0 12px',
    background: 'var(--bg4)', border: '1px solid var(--border2)',
    borderRadius: 8, fontSize: 13, color: 'var(--silver)',
    fontFamily: 'var(--font)', outline: 'none',
    transition: 'border-color 150ms',
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'var(--font)',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 20, padding: '32px 28px',
        boxShadow: 'var(--shadow-lg)',
        animation: 'fadeUp 200ms ease',
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--accent)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 900, margin: '0 auto 12px',
            boxShadow: '0 4px 14px color-mix(in srgb, var(--accent) 40%, transparent)',
          }}>J</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--silver)', letterSpacing: '-0.4px', margin: '0 0 6px' }}>
            Lengkapi Profil
          </h1>
          <p style={{ fontSize: 12, color: 'var(--silver3)', margin: 0 }}>
            Satu langkah lagi untuk masuk ke JateamHub
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Nama Lengkap */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--silver3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, fontFamily: 'var(--mono)' }}>
              Nama Lengkap
            </label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Nama kamu"
              style={iSt}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border2)'}
            />
          </div>

          {/* Username */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--silver3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, fontFamily: 'var(--mono)' }}>
              Username
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username_kamu"
              style={iSt}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border2)'}
            />
            <div style={{ fontSize: 10, color: 'var(--silver4)', marginTop: 4 }}>
              3–30 karakter: huruf kecil, angka, underscore
            </div>
          </div>

          {/* Wilayah */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--silver3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, fontFamily: 'var(--mono)' }}>
              Wilayah
            </label>
            <select value={region} onChange={e => setRegion(e.target.value)} style={{ ...iSt }}>
              {REGIONS.filter(r => r.value !== 'global').map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Unit */}
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--silver3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5, fontFamily: 'var(--mono)' }}>
              Unit
            </label>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...iSt }}>
              {UNITS.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          {err && (
            <div style={{
              padding: '8px 12px', background: 'var(--red-bg)',
              border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
              borderRadius: 8, color: 'var(--red)', fontSize: 12,
            }}>{err}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              height: 42, marginTop: 4,
              background: loading ? 'var(--border2)' : 'var(--accent)',
              border: 'none', borderRadius: 10,
              color: 'white', fontSize: 13, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'var(--font)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Menyimpan...
              </>
            ) : 'Buat Akun'}
          </button>
        </form>

        <button
          onClick={handleCancel}
          style={{
            marginTop: 12, width: '100%', background: 'none', border: 'none',
            color: 'var(--silver4)', fontSize: 12, cursor: 'pointer',
            fontFamily: 'var(--font)', padding: '8px 0',
          }}
        >
          Batal / Kembali ke Login
        </button>
      </div>
    </div>
  )
}
