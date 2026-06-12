import { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { messagePreview } from '../../utils/chatText'
import type { ChatConversation } from '../../utils/supabaseClient'

interface Props { currentUserId: string }

export default function ForwardModal({ currentUserId }: Props) {
  const forwarding    = useChatStore(s => s.forwarding)
  const setForwarding = useChatStore(s => s.setForwarding)
  const conversations = useChatStore(s => s.conversations)
  const forwardMessage = useChatStore(s => s.forwardMessage)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  if (!forwarding) return null

  const other = (conv: ChatConversation) =>
    conv.participant_a === currentUserId ? conv.profile_b : conv.profile_a

  const handleForward = async (convId: string) => {
    if (busyId) return
    setBusyId(convId)
    await forwardMessage(forwarding, convId, currentUserId)
    setBusyId(null)
    setDoneId(convId)
    setTimeout(() => setForwarding(null), 650)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) setForwarding(null) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 420, maxHeight: '80vh',
        background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 18,
        display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', animation: 'fadeUp 180ms ease',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--silver)' }}>Teruskan ke…</span>
          <button onClick={() => setForwarding(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Preview of the message being forwarded */}
        <div style={{ margin: '12px 16px 4px', padding: '8px 12px', background: 'var(--bg4)', borderRadius: 10, borderLeft: '3px solid var(--accent)', fontSize: 12.5, color: 'var(--silver3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {messagePreview(forwarding)}
        </div>

        <div className="chat-msglist" style={{ flex: 1, overflowY: 'auto', padding: '6px 8px 12px' }}>
          {conversations.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--silver4)', fontSize: 13 }}>Belum ada percakapan.</div>
          )}
          {conversations.map(conv => {
            const o = other(conv)
            const done = doneId === conv.id
            return (
              <button
                key={conv.id}
                disabled={!!busyId}
                onClick={() => handleForward(conv.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                  padding: '9px 10px', border: 'none', borderRadius: 11, background: 'none',
                  cursor: busyId ? 'wait' : 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!busyId) (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                  background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: o?.avatar_emoji || o?.emoji ? 18 : 15, fontWeight: 700, color: 'var(--accent)',
                }}>
                  {o?.avatar_url ? <img src={o.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : o?.avatar_emoji || o?.emoji ? <span>{o.avatar_emoji || o.emoji}</span>
                    : <span>{(o?.full_name?.[0] ?? '?').toUpperCase()}</span>}
                </div>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {o?.full_name ?? o?.username ?? 'Unknown'}
                </span>
                {done
                  ? <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>Terkirim ✓</span>
                  : busyId === conv.id
                  ? <span style={{ width: 14, height: 14, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  : <span style={{ color: 'var(--silver4)', fontSize: 12 }}>Teruskan</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
