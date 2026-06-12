// ============================================================
// announce-push — superadmin broadcasts an announcement as a Web Push to all
// targeted users (by role/region/unit). Verifies the caller is a superadmin.
// ============================================================
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  try {
    const { announcement_id } = await req.json().catch(() => ({}))
    if (!announcement_id) return json({ error: 'announcement_id required' }, 400)

    const url        = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await asUser.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(url, serviceKey)
    const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (me?.role !== 'superadmin') return json({ error: 'forbidden' }, 403)

    const { data: ann } = await admin.from('announcements').select('*').eq('id', announcement_id).single()
    if (!ann) return json({ error: 'not found' }, 404)

    // Targeted users
    let q = admin.from('profiles').select('id')
    if (ann.target_role)   q = q.eq('role', ann.target_role)
    if (ann.target_region) q = q.eq('region_scope', ann.target_region)
    if (ann.target_unit)   q = q.eq('unit_scope', ann.target_unit)
    const { data: users } = await q
    const userIds = (users ?? []).map((u: { id: string }) => u.id).filter((id: string) => id !== user.id)
    if (!userIds.length) return json({ ok: true, sent: 0 })

    const { data: subs } = await admin
      .from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', userIds)
    if (!subs?.length) return json({ ok: true, sent: 0 })

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!,
    )
    const payload = JSON.stringify({
      title: `📢 ${ann.title}`,
      body:  String(ann.body).slice(0, 140),
      url:   '/',
      tag:   `announcement-${ann.id}`,
    })

    let sent = 0
    await Promise.all(subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        sent++
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      }
    }))

    return json({ ok: true, sent })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
