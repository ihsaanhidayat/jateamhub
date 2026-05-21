import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../../store/authStore'
import { applyThemeToDOM } from '../../store/dashboardStore'

// ── Matrix Rain — hanya untuk Obsidian ───────────────────────
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    const cols = Math.floor(canvas.width / 14)
    const drops = Array(cols).fill(1)
    const chars = 'アイウエオカキクケコ0123456789ABCDEF'.split('')
    const draw = () => {
      ctx.fillStyle = 'rgba(8,8,8,0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)]
        ctx.fillStyle = `rgba(110,231,183,${Math.random() * 0.5 + 0.1})`
        ctx.font = '12px monospace'
        ctx.fillText(char, i * 14, y * 14)
        if (y * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0
        drops[i]++
      })
    }
    const interval = setInterval(draw, 50)
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, opacity: 0.2, pointerEvents: 'none', zIndex: 0 }}
    />
  )
}

export default function LoginPage({ onRegister }: { onRegister?: () => void }) {
  const { login } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [isObsidian, setIsObsidian] = useState(false)
  const [cooldown, setCooldown] = useState(0)  // brute force protection

  // Countdown cooldown
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => {
      if (c <= 1) { clearInterval(t); return 0 }
      return c - 1
    }), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  // Baca tema dari localStorage — terapkan ke DOM seketika
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jateamhub-appearance')
      const app = saved ? JSON.parse(saved) : null
      const dark = app?.themeBase === 'obsidian'
      setIsObsidian(dark)
      applyThemeToDOM(dark ? 'obsidian' : 'ivory-light')
    } catch {
      applyThemeToDOM('ivory-light')
    }
  }, [])

  const [failCount, setFailCount] = useState(0)

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
      // Cooldown bertingkat: 3 gagal = 10 detik, 5 = 30 detik, dst
      if (newFail >= 5) setCooldown(30)
      else if (newFail >= 3) setCooldown(10)
      setErr(newFail >= 3
        ? `Terlalu banyak percobaan. Tunggu ${newFail >= 5 ? '30' : '10'} detik.`
        : 'Username atau password salah.')
      triggerShake()
    } else {
      setFailCount(0)
    }
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',        // ← ikut tema
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      fontFamily: 'var(--font)',       // ← ikut tema (Plus Jakarta / Space Grotesk)
      position: 'relative',
      transition: 'background 300ms ease',
    }}>
      {/* Background effect per tema */}
      {isObsidian ? (
        <>
          <MatrixRain />
          <div style={{
            position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1,
            background: 'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(110,231,183,0.04) 0%, transparent 70%)',
          }} />
        </>
      ) : (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            radial-gradient(circle at 15% 50%, rgba(37,99,235,0.05) 0%, transparent 50%),
            radial-gradient(circle at 85% 20%, rgba(37,99,235,0.04) 0%, transparent 40%)
          `,
        }} />
      )}

      {/* Card */}
      <div
        className={shake ? 'login-shake' : ''}
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: isObsidian ? 380 : 400,
          background: 'var(--bg3)',      // ← ikut tema
          border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-xl)',
          padding: '40px 36px',
          boxShadow: 'var(--shadow-lg)', // ← ikut tema
          backdropFilter: isObsidian ? 'blur(20px)' : 'none',
          animation: 'scaleIn 300ms var(--ease)',
        }}
      >
        {/* Accent top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 24, right: 24, height: 2,
          background: `linear-gradient(90deg, var(--accent), transparent)`,
          borderRadius: '0 0 2px 2px',
        }} />

        {/* Brand */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
            justifyContent: 'center',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: isObsidian ? '#0C0C0C' : 'white',
              flexShrink: 0,
            }}>J</div>
            <h1 style={{
              fontSize: 22, fontWeight: 800,
              color: 'var(--silver)',
              letterSpacing: '-0.4px', margin: 0,
            }}>JateamHub</h1>
          </div>
          <p style={{
            fontSize: 13,
            color: 'var(--silver2)',
            margin: 0,
            fontFamily: 'var(--font)',
          }}>
            Selamat datang, Jagoan.
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', marginBottom: 24 }} />

        <form onSubmit={handleLogin} autoComplete="on">
          {/* Username */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              fontSize: isObsidian ? 10 : 12,
              fontWeight: 700,
              color: 'var(--silver3)',
              marginBottom: 6,
              letterSpacing: isObsidian ? '1.5px' : 'normal',
              textTransform: isObsidian ? 'uppercase' : 'none',
              fontFamily: isObsidian ? 'var(--mono)' : 'var(--font)',
            }}>
              Username
            </label>
            <input
              value={username}
              onChange={e => { setUsername(e.target.value); setErr('') }}
              placeholder={isObsidian ? 'username' : 'Masukkan username'}
              autoComplete="username"
              autoFocus
              disabled={loading}
              style={{
                width: '100%', height: 48,
                background: 'var(--bg2)',
                border: `1.5px solid ${err ? 'var(--color-error)' : 'var(--border2)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '0 14px',
                color: 'var(--silver)',
                fontSize: 14,
                fontFamily: 'var(--font)',
                outline: 'none',
                boxSizing: 'border-box' as const,
                transition: 'border-color 150ms ease, background 150ms ease',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--accent)'
                e.target.style.background = 'var(--bg3)'
              }}
              onBlur={e => {
                e.target.style.borderColor = err ? 'var(--color-error)' : 'var(--border2)'
                e.target.style.background = 'var(--bg2)'
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: isObsidian ? 10 : 12,
              fontWeight: 700,
              color: 'var(--silver3)',
              marginBottom: 6,
              letterSpacing: isObsidian ? '1.5px' : 'normal',
              textTransform: isObsidian ? 'uppercase' : 'none',
              fontFamily: isObsidian ? 'var(--mono)' : 'var(--font)',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setErr('') }}
                placeholder={isObsidian ? '••••••••' : 'Masukkan password'}
                autoComplete="current-password"
                disabled={loading}
                style={{
                  width: '100%', height: 48,
                  background: 'var(--bg2)',
                  border: `1.5px solid ${err ? 'var(--color-error)' : 'var(--border2)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '0 44px 0 14px',
                  color: 'var(--silver)',
                  fontSize: 14,
                  fontFamily: 'var(--font)',
                  outline: 'none',
                  boxSizing: 'border-box' as const,
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--accent)'
                  e.target.style.background = 'var(--bg3)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = err ? 'var(--color-error)' : 'var(--border2)'
                  e.target.style.background = 'var(--bg2)'
                }}
              />
              {/* Show/hide password */}
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--silver3)', cursor: 'pointer',
                  fontSize: 14, padding: 4, lineHeight: 1,
                }}
                tabIndex={-1}
              >{showPw ? '🙈' : '👁'}</button>
            </div>
          </div>

          {/* Error */}
          {err && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              background: 'var(--color-error-bg)',
              border: '1px solid var(--color-error)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              color: 'var(--color-error)',
              fontSize: 12, lineHeight: 1.5, marginBottom: 16,
              animation: 'fadeIn 150ms ease',
            }}>
              <span style={{ flexShrink: 0 }}>⚠</span>
              <span>{err}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || cooldown > 0}
            style={{
              width: '100%', height: 48,
              background: (loading || cooldown > 0) ? 'var(--border2)' : 'var(--accent)',
              border: isObsidian ? '1px solid var(--accent)' : 'none',
              borderRadius: 'var(--radius-sm)',
              color: isObsidian ? 'var(--accent)' : 'white',
              fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)',
              letterSpacing: isObsidian ? '1px' : 'normal',
              transition: 'all 150ms ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => {
              if (!loading) {
                const b = e.currentTarget as HTMLButtonElement
                b.style.opacity = '0.88'
                b.style.transform = 'translateY(-1px)'
              }
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement
              b.style.opacity = '1'
              b.style.transform = 'translateY(0)'
            }}
          >
            {loading
              ? <><span className="login-spinner" style={{ borderTopColor: isObsidian ? 'var(--accent)' : 'white' }} /> Masuk...</>
              : cooldown > 0 ? `Tunggu ${cooldown}s...` : 'Masuk'
            }
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: 24, textAlign: 'center',
          fontSize: 12, color: 'var(--silver3)',
        }}>
          Belum punya akun?{' '}
          <span
            onClick={onRegister}
            style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
          >Daftar di sini</span>
        </div>
      </div>
    </div>
  )
}
