import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'

export default function LoginPage() {
  const { login } = useAuthStore()
  const [showPw, setShowPw] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setErr('Username dan password wajib diisi.')
      triggerShake()
      return
    }
    setErr(''); setLoading(true)
    const error = await login(username.trim(), password)
    setLoading(false)
    if (error) {
      setErr('Sampean salah atau lupa password? Colek admin ya 😄')
      triggerShake()
    }
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  return (
    <div className="login-page">
      <div className={`login-box${shake ? ' login-shake' : ''}`}>
        <div className="login-logo">
          <h1>JateamHub</h1>
          <h3>Sugeng Rawuh, Jagoan</h3>
          <div className="underline" />
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Username</label>
            <input
              value={username}
              onChange={e => { setUsername(e.target.value); setErr('') }}
              placeholder="username"
              autoComplete="username"
              autoFocus
              disabled={loading}
              className={shake ? 'input-error' : ''}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="pw-wrap">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setErr('') }}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                className={shake ? 'input-error' : ''}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {err && (
            <div className="login-error-box">
              <span className="login-error-icon">⚠️</span>
              <span>{err}</span>
            </div>
          )}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="login-spinner" />
                Masuk...
              </span>
            ) : 'LOGIN'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'var(--silver3)', lineHeight: 1.8 }}>
          Tidak punya akun?<br />
          Hubungi <span style={{ color: 'var(--mint)', fontWeight: 600 }}>Admin</span> untuk mendapatkan akses.
        </div>
      </div>
    </div>
  )
}
