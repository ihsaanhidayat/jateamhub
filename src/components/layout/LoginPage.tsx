import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../../store/authStore'

// Matrix rain canvas
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ∑∆∏√∞≈≠∈∉∩∪⊂⊃'
    const fontSize = 13
    let cols = Math.floor(canvas.width / fontSize)
    let drops: number[] = Array(cols).fill(1)

    const draw = () => {
      ctx.fillStyle = 'rgba(10,10,10,0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      cols = Math.floor(canvas.width / fontSize)
      if (drops.length !== cols) drops = Array(cols).fill(1)

      for (let i = 0; i < drops.length; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]
        const alpha = Math.random() > 0.95 ? 1 : 0.15 + Math.random() * 0.4

        // Leading char — bright mint
        if (drops[i] * fontSize > canvas.height * 0.7 + Math.random() * canvas.height * 0.3) {
          ctx.fillStyle = `rgba(0,255,194,${alpha})`
        } else {
          ctx.fillStyle = `rgba(0,255,194,${alpha * 0.5})`
        }

        ctx.font = `${fontSize}px 'JetBrains Mono', monospace`
        ctx.fillText(char, i * fontSize, drops[i] * fontSize)

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i]++
      }
    }

    const interval = setInterval(draw, 45)
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0,
        opacity: 0.35,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}

export default function LoginPage({ onRegister }: { onRegister?: () => void }) {
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
      triggerShake(); return
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
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#080808',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* Matrix rain background */}
      <MatrixRain />

      {/* Radial glow center */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,255,194,0.06) 0%, transparent 70%)',
      }} />

      {/* Grid lines overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(0,255,194,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,194,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />

      {/* Login box */}
      <div
        className={shake ? 'login-shake' : ''}
        style={{
          position: 'relative', zIndex: 10,
          width: 360, background: 'rgba(10,10,10,0.85)',
          border: '1px solid rgba(0,255,194,0.4)',
          borderRadius: 12, padding: '40px 32px',
          backdropFilter: 'blur(20px)',
          boxShadow: `
            0 0 0 1px rgba(0,255,194,0.08),
            0 0 40px rgba(0,255,194,0.12),
            0 0 80px rgba(0,255,194,0.06),
            0 20px 60px rgba(0,0,0,0.6)
          `,
        }}
      >
        {/* Corner accents */}
        {[
          { top: -1, left: -1, borderTop: '2px solid #00FFC2', borderLeft: '2px solid #00FFC2', borderRadius: '12px 0 0 0' },
          { top: -1, right: -1, borderTop: '2px solid #00FFC2', borderRight: '2px solid #00FFC2', borderRadius: '0 12px 0 0' },
          { bottom: -1, left: -1, borderBottom: '2px solid #00FFC2', borderLeft: '2px solid #00FFC2', borderRadius: '0 0 0 12px' },
          { bottom: -1, right: -1, borderBottom: '2px solid #00FFC2', borderRight: '2px solid #00FFC2', borderRadius: '0 0 12px 0' },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', width: 20, height: 20, ...s,
          }} />
        ))}

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 32, fontWeight: 700, color: '#00FFC2',
            letterSpacing: '-1px', fontFamily: 'var(--font)',
            textShadow: '0 0 20px rgba(0,255,194,0.8), 0 0 40px rgba(0,255,194,0.4), 0 0 80px rgba(0,255,194,0.2)',
          }}>JateamHub</h1>
          <h3>Sugeng Rawuh, Jagoan</h3>
          <div style={{
            width: 50, height: 2, background: 'linear-gradient(90deg, transparent, #00FFC2, transparent)',
            margin: '8px auto 0',
            boxShadow: '0 0 8px rgba(0,255,194,0.8)',
          }} />
          <div style={{ fontSize: 11, color: 'rgba(0,255,194,0.5)', marginTop: 8, letterSpacing: '2px', textTransform: 'uppercase', fontFamily: 'var(--mono)' }}>
            Internal Portal
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', color: 'rgba(0,255,194,0.6)', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'var(--mono)' }}>Username</label>
            <input
              value={username}
              onChange={e => { setUsername(e.target.value); setErr('') }}
              placeholder="username"
              autoComplete="username"
              autoFocus
              disabled={loading}
              style={{
                width: '100%', background: 'rgba(0,255,194,0.04)',
                border: `1px solid ${err ? 'rgba(224,85,85,0.6)' : 'rgba(0,255,194,0.2)'}`,
                borderRadius: 6, padding: '10px 12px',
                color: '#E0E0E0', fontSize: 14, fontFamily: 'var(--font)',
                transition: 'all .2s', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(0,255,194,0.7)'}
              onBlur={e => e.target.style.borderColor = err ? 'rgba(224,85,85,0.6)' : 'rgba(0,255,194,0.2)'}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: '1.2px', color: 'rgba(0,255,194,0.6)', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'var(--mono)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setErr('') }}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                style={{
                  width: '100%', background: 'rgba(0,255,194,0.04)',
                  border: `1px solid ${err ? 'rgba(224,85,85,0.6)' : 'rgba(0,255,194,0.2)'}`,
                  borderRadius: 6, padding: '10px 12px',
                  color: '#E0E0E0', fontSize: 14, fontFamily: 'var(--font)',
                  transition: 'all .2s', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(0,255,194,0.7)'}
                onBlur={e => e.target.style.borderColor = err ? 'rgba(224,85,85,0.6)' : 'rgba(0,255,194,0.2)'}
              />
            </div>
          </div>

          {err && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.25)',
              borderRadius: 6, padding: '10px 12px',
              color: '#ff8080', fontSize: 12, lineHeight: 1.5, marginBottom: 12,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
              <span>{err}</span>
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: '100%', background: 'transparent',
              border: '1px solid rgba(0,255,194,0.6)',
              color: '#00FFC2', padding: '12px',
              borderRadius: 6, fontSize: 13, fontWeight: 700,
              letterSpacing: '2px', textTransform: 'uppercase',
              transition: 'all .2s', marginTop: 4,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)',
              boxShadow: '0 0 10px rgba(0,255,194,0.1)',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={e => {
              if (!loading) {
                const b = e.currentTarget
                b.style.background = 'rgba(0,255,194,0.12)'
                b.style.boxShadow = '0 0 20px rgba(0,255,194,0.3), 0 0 40px rgba(0,255,194,0.1)'
                b.style.borderColor = '#00FFC2'
              }
            }}
            onMouseLeave={e => {
              const b = e.currentTarget
              b.style.background = 'transparent'
              b.style.boxShadow = '0 0 10px rgba(0,255,194,0.1)'
              b.style.borderColor = 'rgba(0,255,194,0.6)'
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="login-spinner" />
                Masuk...
              </span>
            ) : 'LOGIN'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.8, fontFamily: 'var(--mono)' }}>
          Tidak punya akun?{' '}
          <span onClick={onRegister} style={{ color: 'rgba(0,255,194,0.9)', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
            Daftar di sini
          </span>
        </div>
      </div>
    </div>
  )
}
