// ============================================================
// audit-log — append an authoritative audit entry. Actor is taken from the
// caller's JWT (can't be forged), IP from the request headers. Inserts with
// the service role so the table needs no client-writable RLS.
// ============================================================
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
    const { action, target_type, target_id, target_label, metadata } = await req.json().catch(() => ({}))
    if (!action) return json({ error: 'action required' }, 400)

    const url        = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await asUser.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(url, serviceKey)
    const { data: p } = await admin.from('profiles').select('full_name, username').eq('id', user.id).single()
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null

    await admin.from('audit_logs').insert({
      actor_id:     user.id,
      actor_name:   p?.full_name || p?.username || null,
      action:       String(action).slice(0, 64),
      target_type:  target_type ? String(target_type).slice(0, 32) : null,
      target_id:    target_id ? String(target_id).slice(0, 64) : null,
      target_label: target_label ? String(target_label).slice(0, 200) : null,
      metadata:     metadata ?? {},
      ip,
    })

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
