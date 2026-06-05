import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../utils/supabaseClient'

const IDLE_LIMIT_MS    = 30 * 60 * 1000   // 30 menit idle = sesi habis
const WARN_BEFORE_MS   = 60 * 1000        // peringatan 60 detik sebelum logout
const ACTIVITY_EVENTS  = ['mousedown', 'keydown', 'touchstart', 'scroll']

export default function IdleSessionGuard() {
  const { profile, logout } = useAuthStore()
  const [showWarn, setShowWarn] = useState(false)
  const [countdown, setCountdown] = useState(WARN_BEFORE_MS / 1000)
  const lastActivity = useRef<number>(Date.now())
  const warnTimer    = useRef<ReturnType<typeof setTimeout>|null>(null)
  const logoutTimer  = useRef<ReturnType<typeof setTimeout>|null>(null)
  const countTimer   = useRef<ReturnType<typeof setInterval>|null>(null)

  // Helper: clear semua timer
  const clearTimers = () => {
    if (warnTimer.current) clearTimeout(warnTimer.current)
    if (logoutTimer.current) clearTimeout(logoutTimer.current)
    if (countTimer.current) clearInterval(countTimer.current)
  }

  // Reset timer setiap aktivitas
  const resetIdleTimer = () => {
    if (showWarn) return  // sedang ada warning, tunggu user response
    lastActivity.current = Date.now()
    clearTimers()
    // Schedule warning
    warnTimer.current = setTimeout(() => {
      setShowWarn(true)
      setCountdown(WARN_BEFORE_MS / 1000)
      // Countdown tick
      countTimer.current = setInterval(() => {
        setCountdown(c => c > 0 ? c - 1 : 0)
      }, 1000)
      // Schedule force logout setelah warning timeout
      logoutTimer.current = setTimeout(() => {
        clearTimers()
        setShowWarn(false)
        logout()
      }, WARN_BEFORE_MS)
    }, IDLE_LIMIT_MS - WARN_BEFORE_MS)
  }

  // Setup listener saat profile aktif
  useEffect(() => {
    if (!profile) {
      clearTimers()
      setShowWarn(false)
      return
    }
    resetIdleTimer()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }))
    return () => {
      clearTimers()
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetIdleTimer))
    }
  }, [profile?.id])

  // Lanjutkan sesi: refresh token + reset timer
  const extendSession = async () => {
    setShowWarn(false)
    clearTimers()
    try {
      await supabase.auth.refreshSession()
    } catch (e) {
      console.warn('Refresh session failed:', e)
    }
    resetIdleTimer()
  }

  // Logout sekarang
  const logoutNow = () => {
    clearTimers()
    setShowWarn(false)
    logout()
  }

  if (!showWarn || !profile) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9700,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'fadeIn 300ms var(--ease)',
    }}>
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        borderRadius: 20, width: '100%', maxWidth: 380,
        overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        animation: 'scaleIn 300ms var(--ease)',
      }}>
        {/* Accent bar */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #F59E0B, var(--red))' }} />

        {/* Header */}
        <div style={{ padding: '24px 24px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 44, marginBottom: 10, lineHeight: 1 }}>⏳</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--silver)', letterSpacing: '-0.3px' }}>
            Sesi Akan Habis
          </div>
          <div style={{ fontSize: 13, color: 'var(--silver3)', marginTop: 8, lineHeight: 1.5 }}>
            Karena tidak ada aktivitas, sesi kamu akan berakhir dalam:
          </div>
          <div style={{
            fontSize: 36, fontWeight: 800, fontFamily: 'var(--mono)',
            color: countdown <= 10 ? 'var(--red)' : 'var(--accent)',
            marginTop: 12, letterSpacing: '-1px',
          }}>{countdown}s</div>
        </div>

        {/* Actions */}
        <div style={{ padding: '14px 16px 18px', display: 'flex', gap: 8 }}>
          <button onClick={logoutNow} style={{
            flex: 1, height: 42, background: 'none',
            border: '1px solid var(--border2)', borderRadius: 10,
            color: 'var(--silver3)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>Keluar</button>
          <button onClick={extendSession} style={{
            flex: 2, height: 42, background: 'var(--accent)',
            border: 'none', borderRadius: 10,
            color: 'white', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font)',
            transition: 'opacity 150ms',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >Lanjutkan Sesi</button>
        </div>
      </div>
    </div>
  )
}
