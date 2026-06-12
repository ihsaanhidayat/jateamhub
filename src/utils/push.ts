// Web Push subscription management (closed-app notifications).
import { supabase } from './supabaseClient'

// Public VAPID key — safe to ship to the client. The private key lives only
// in the notify-push Edge Function's secrets.
const VAPID_PUBLIC = 'BNMJm9iUgIP3uXd_OTBzqgt0bzXDChUz-oTvGPktbnggavwR_WPcTVSW2wgoWj0JYMSW7Fjs0qWBb4ALAq-qbCM'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// Subscribe this device for push and store the subscription. Idempotent.
export async function registerPushSubscription(userId: string): Promise<boolean> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return false
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
    }
    const j = sub.toJSON()
    if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false
    const { error } = await supabase.from('push_subscriptions').upsert({
      endpoint:   j.endpoint,
      user_id:    userId,
      p256dh:     j.keys.p256dh,
      auth:       j.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    }, { onConflict: 'endpoint' })
    if (error) { console.warn('push upsert failed', error); return false }
    return true
  } catch (e) {
    console.warn('push subscribe failed', e)
    return false
  }
}

// Remove this device's subscription (on logout).
export async function unregisterPushSubscription(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch { /* best effort */ }
}
