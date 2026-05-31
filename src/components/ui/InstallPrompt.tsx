import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null)
  const [show,   setShow]   = useState(false)
  const [ios,    setIos]    = useState(false)

  useEffect(() => {
    // Sudah install sebagai PWA — tidak perlu prompt
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if ((navigator as any).standalone) return

    // iOS detection
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent)
    if (isIos && isSafari) {
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (!dismissed) { setIos(true); setShow(true) }
      return
    }

    // Android/Chrome — beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (!dismissed) { setPrompt(e); setShow(true) }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (ios) { setShow(false); return }
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') localStorage.setItem('pwa-install-dismissed', '1')
    setShow(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: `calc(16px + env(safe-area-inset-bottom))`,
      left: 16, right: 16, zIndex: 9998,
      background: 'var(--bg2)', border: '1px solid var(--border2)',
      borderRadius: 14, padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', gap: 12,
      animation: 'fadeUp 300ms cubic-bezier(0.16,1,0.3,1)',
    }}>
      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'var(--accent)', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 900,
      }}>J</div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--silver)' }}>
          Install JateamHub
        </div>
        <div style={{ fontSize: 11, color: 'var(--silver3)', marginTop: 2 }}>
          {ios
            ? 'Tap 󰏌 lalu "Add to Home Screen"'
            : 'Akses lebih cepat dari homescreen'}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={handleDismiss} style={{
          height: 32, padding: '0 10px', background: 'none',
          border: '1px solid var(--border2)', borderRadius: 8,
          color: 'var(--silver3)', fontSize: 12, cursor: 'pointer',
          fontFamily: 'var(--font)',
        }}>Nanti</button>
        {!ios && (
          <button onClick={handleInstall} style={{
            height: 32, padding: '0 12px', background: 'var(--accent)',
            border: 'none', borderRadius: 8,
            color: 'white', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>Install</button>
        )}
      </div>
    </div>
  )
}
