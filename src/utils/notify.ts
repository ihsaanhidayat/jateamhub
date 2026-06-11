// In-app notification + sound helpers for chat (no backend / VAPID needed).
// Plays a WebAudio "ping" and shows an OS notification when the app is
// open/backgrounded. Works on desktop and installed PWA.

let _audioCtx: AudioContext | null = null

// Pleasant two-tone ping synthesized at runtime — no audio asset required.
export function playPing() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    _audioCtx ??= new AC()
    const ctx = _audioCtx
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    const tone = (freq: number, t0: number, dur: number, peak: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      o.connect(g); g.connect(ctx.destination)
      g.gain.setValueAtTime(0.0001, now + t0)
      g.gain.exponentialRampToValueAtTime(peak, now + t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur)
      o.start(now + t0); o.stop(now + t0 + dur + 0.02)
    }
    tone(880,  0,    0.18, 0.16)
    tone(1175, 0.11, 0.22, 0.16)
  } catch { /* audio blocked — ignore */ }
}

// Browsers require a user gesture before audio can play. Call once on
// first interaction (e.g. unlocking chat) to unlock the AudioContext.
export function primeAudio() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    _audioCtx ??= new AC()
    if (_audioCtx.state === 'suspended') _audioCtx.resume()
  } catch { /* ignore */ }
}

export async function ensureNotifyPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied')  return false
  try { return (await Notification.requestPermission()) === 'granted' }
  catch { return false }
}

interface NotifyOpts { tag?: string; onClickHash?: string }

export function showMessageNotification(title: string, body: string, opts: NotifyOpts = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const url = opts.onClickHash ? `/${opts.onClickHash}` : '/'
  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    tag:   opts.tag ?? 'jateamhub-chat',
    renotify: true,
    vibrate: [80, 40, 80],
    data:  { url },
  }
  // Prefer the service-worker registration (required on mobile/installed PWA).
  if (navigator.serviceWorker?.getRegistration) {
    navigator.serviceWorker.getRegistration()
      .then(reg => {
        if (reg) reg.showNotification(title, options)
        else fallbackNotification(title, options, opts.onClickHash)
      })
      .catch(() => fallbackNotification(title, options, opts.onClickHash))
  } else {
    fallbackNotification(title, options, opts.onClickHash)
  }
}

function fallbackNotification(title: string, options: NotificationOptions, hash?: string) {
  try {
    const n = new Notification(title, options)
    n.onclick = () => {
      window.focus()
      if (hash) window.location.hash = hash
      n.close()
    }
  } catch { /* ignore */ }
}
