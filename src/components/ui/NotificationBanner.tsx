import { useState, useEffect } from 'react'

interface Props { userId: string }

export default function NotificationBanner({ userId }: Props) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'default') return
    const key = `jateamhub-notif-asked-${userId}`
    if (localStorage.getItem(key)) return
    const t = setTimeout(() => setShow(true), 4000)
    return () => clearTimeout(t)
  }, [userId])

  const dismiss = () => {
    localStorage.setItem(`jateamhub-notif-asked-${userId}`, '1')
    setShow(false)
  }

  const enable = async () => {
    try {
      const result = await Notification.requestPermission()
      if (result === 'granted') {
        new Notification('JateamHub', {
          body: 'Notifikasi todo aktif! Kamu akan diingatkan sebelum deadline. 🔔',
          icon: '/icon-192.png',
        })
      }
    } catch { /* browser restriction */ }
    dismiss()
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: `calc(60px + env(safe-area-inset-bottom, 0px))`,
      left: 16, right: 16,
      zIndex: 9990,
      background: 'var(--bg2)',
      border: '1px solid var(--border2)',
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: 'var(--shadow-lg)',
      animation: 'slideInUp 300ms var(--ease)',
      maxWidth: 480, margin: '0 auto',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: 'var(--accent-light)', border: '1px solid var(--border2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>🔔</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--silver)', lineHeight: 1.3 }}>
          Aktifkan notifikasi pengingat
        </div>
        <div style={{ fontSize: 11, color: 'var(--silver3)', marginTop: 2, lineHeight: 1.3 }}>
          Dapatkan pengingat todo sebelum deadline, bahkan saat tab lain aktif.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={dismiss}
          style={{
            height: 34, padding: '0 10px',
            background: 'none', border: '1px solid var(--border2)',
            borderRadius: 8, color: 'var(--silver3)', fontSize: 12,
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>Nanti</button>
        <button
          onClick={enable}
          style={{
            height: 34, padding: '0 12px',
            background: 'var(--accent)', border: 'none',
            borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>Aktifkan</button>
      </div>
    </div>
  )
}
