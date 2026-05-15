import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'

export default function LoginPage() {
  const { login } = useAuthStore()
  const [showPw, setShowPw]     = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [err, setErr]           = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) { setErr('Username dan password wajib diisi.'); return }
    setErr(''); setLoading(true)
    const error = await login(username.trim(), password)
    setLoading(false)
    if (error) setErr(error)
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <h1>JateamHub</h1>
          <div className="underline" />
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              autoComplete="username"
              autoFocus
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="pw-wrap">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div className="login-error">{err}</div>
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Masuk...' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'var(--silver3)', lineHeight: 1.6 }}>
          Tidak punya akun?<br/>
          Hubungi <span style={{ color: 'var(--mint)' }}>Admin</span> untuk mendapatkan akses.
        </div>
      </div>
    </div>
  )
}
