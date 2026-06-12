// ============================================================
// notify-push — send a Web Push to the other participant of a
// conversation when a new message is sent. Content stays generic
// ("Pesan baru") because messages are end-to-end encrypted.
// ============================================================
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  try {
    const { conversation_id } = await req.json().catch(() => ({}))
    if (!conversation_id) return json({ error: 'conversation_id required' }, 400)

    const url        = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // Identify the caller from their JWT.
    const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await asUser.auth.getUser()
    if (!user) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(url, serviceKey)

    // Verify the caller participates in the conversation; find the recipient.
    const { data: conv } = await admin
      .from('chat_conversations')
      .select('participant_a, participant_b')
      .eq('id', conversation_id).single()
    if (!conv || (conv.participant_a !== user.id && conv.participant_b !== user.id)) {
      return json({ error: 'forbidden' }, 403)
    }
    const recipient = conv.participant_a === user.id ? conv.participant_b : conv.participant_a

    // Sender's display name for the notification title.
    const { data: sp } = await admin.from('profiles').select('full_name, username').eq('id', user.id).single()
    const title = sp?.full_name || sp?.username || 'Pesan baru'

    const { data: subs } = await admin
      .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', recipient)
    if (!subs?.length) return json({ ok: true, sent: 0 })

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const payload = JSON.stringify({
      title, body: 'Pesan baru', url: '/#chat', tag: `chat-${conversation_id}`,
    })

    let sent = 0
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        sent++
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      }
    }))

    return json({ ok: true, sent })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
