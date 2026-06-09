import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'

interface Props { onRegister?: () => void }

export default function LoginPage({ onRegister }: Props) {
  const { login } = useAuthStore()
  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [err,       setErr]       = useState('')
  const [loading,   setLoading]   = useState(false)
  const [shake,     setShake]     = useState(false)
  const [cooldown,  setCooldown]  = useState(0)
  const [failCount, setFailCount] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => {
      if (c <= 1) { clearInterval(t); return 0 }
      return c - 1
    }), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cooldown > 0) return
    if (!username.trim() || !password) {
      setErr('Username dan password wajib diisi.')
      triggerShake(); return
    }
    setErr(''); setLoading(true)
    const error = await login(username.trim(), password)
    setLoading(false)
    if (error) {
      const newFail = failCount + 1
      setFailCount(newFail)
      if (newFail >= 5) {
        setCooldown(30); setFailCount(0)
        setErr('Terlalu banyak percobaan. Tunggu 30 detik.')
      } else {
        setErr(error)
      }
      triggerShake()
    }
  }

  const iSt: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 14px',
    background: 'var(--bg4)', border: '1px solid var(--border2)',
    borderRadius: 10, fontSize: 14, color: 'var(--silver)',
    fontFamily: 'var(--font)', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 150ms',
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'var(--font)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `
          radial-gradient(circle 800px at 20% 30%, color-mix(in srgb, var(--accent) 6%, transparent) 0%, transparent 70%),
          radial-gradient(circle 600px at 80% 70%, color-mix(in srgb, var(--accent) 4%, transparent) 0%, transparent 70%)
        `,
      }} />
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
        backgroundSize: '48px 48px', opacity: 0.4,
      }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 380,
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 20, padding: '36px 32px',
        boxShadow: 'var(--shadow-lg)',
        animation: shake ? 'shake 0.4s ease' : 'none',
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--accent)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 900, margin: '0 auto 14px',
            boxShadow: '0 4px 14px color-mix(in srgb, var(--accent) 40%, transparent)',
          }}>J</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--silver)', letterSpacing: '-0.5px', margin: '0 0 6px' }}>
            JateamHub
          </h1>
          <p style={{ fontSize: 13, color: 'var(--silver3)', margin: 0 }}>
            Selamat datang, Jagoan.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} autoComplete="on" noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="login-username" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--silver3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, fontFamily: 'var(--mono)' }}>
              Username
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              autoComplete="username"
              aria-required="true"
              aria-invalid={!!(err && !username)}
              aria-describedby={err ? 'login-error' : undefined}
              onChange={e => { setUsername(e.target.value); setErr('') }}
              placeholder="username kamu"
              style={{ ...iSt, borderColor: err && !username ? 'var(--red)' : 'var(--border2)' }}
              onFocus={e  => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e   => e.target.style.borderColor = err && !username ? 'var(--red)' : 'var(--border2)'}
            />
          </div>

          <div>
            <label htmlFor="login-password" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--silver3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6, fontFamily: 'var(--mono)' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                autoComplete="current-password"
                aria-required="true"
                aria-invalid={!!(err && !password)}
                aria-describedby={err ? 'login-error' : undefined}
                onChange={e => { setPassword(e.target.value); setErr('') }}
                placeholder="password kamu"
                style={{ ...iSt, padding: '0 44px 0 14px', borderColor: err && !password ? 'var(--red)' : 'var(--border2)' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e  => e.target.style.borderColor = err && !password ? 'var(--red)' : 'var(--border2)'}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--silver4)', fontSize: 15, padding: 2,
                }}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {err && (
            <div id="login-error" role="alert" style={{
              padding: '10px 14px', background: 'var(--red-bg)',
              border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
              borderRadius: 8, color: 'var(--red)', fontSize: 13,
            }}>{err}</div>
          )}

          <button
            type="submit"
            disabled={loading || cooldown > 0}
            style={{
              width: '100%', height: 44, marginTop: 4,
              background: loading || cooldown > 0 ? 'var(--border2)' : 'var(--accent)',
              border: 'none', borderRadius: 10,
              color: 'white', fontSize: 14, fontWeight: 700,
              cursor: loading || cooldown > 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)', transition: 'background 150ms',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Masuk...
              </>
            ) : cooldown > 0 ? `Tunggu ${cooldown}s...` : 'Masuk'}
          </button>
        </form>

        {onRegister && (
          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--silver3)' }}>
            Belum punya akun?{' '}
            <button
              type="button"
              onClick={onRegister}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'var(--font)' }}>
              Daftar di sini
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
