import { useState } from 'react'
import { useStore } from '../../store/dashboardStore'

export default function LoginPage() {
  const { login } = useStore()
  const [showPw, setShowPw] = useState(false)
  const [lUser, setLUser] = useState('')
  const [lPass, setLPass] = useState('')
  const [remember, setRemember] = useState<'never' | 'session' | 'always'>('never')
  const [err, setErr] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const error = login(lUser.trim(), lPass, remember)
    if (error) setErr(error)
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <h1>JateamHub</h1>
          <h3>Sugeng Rawuh, Jagoan</h3>
          <div className="underline" />
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Username</label>
            <input
              value={lUser}
              onChange={e => setLUser(e.target.value)}
              placeholder="username"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div className="pw-wrap">
              <input
                type={showPw ? 'text' : 'password'}
                value={lPass}
                onChange={e => setLPass(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw(v => !v)}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Remember Me</label>
            <select value={remember} onChange={e => setRemember(e.target.value as typeof remember)}>
              <option value="never">Never</option>
              <option value="session">This Session</option>
              <option value="always">Always</option>
            </select>
          </div>
          <div className="login-error">{err}</div>
          <button type="submit" className="btn-login">Login</button>
        </form>

        <div style={{
          marginTop: 20, textAlign: 'center',
          fontSize: 11, color: 'var(--silver3)', lineHeight: 1.6,
        }}>
          Tidak punya akun?<br />
          Hubungi <span style={{ color: 'var(--mint)' }}>Admin</span> untuk mendapatkan akses.
        </div>
      </div>
    </div>
  )
}
