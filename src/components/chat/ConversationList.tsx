import { useState, useMemo } from 'react'
import { useChatStore } from '../../store/chatStore'
import type { ChatConversation } from '../../utils/supabaseClient'
import { ONLINE_WINDOW_MS } from '../../utils/presence'

interface Props {
  currentUserId: string
  onNewChat:     () => void
  onSelectConv?: (id: string) => void
  mobile?:       boolean
}

const fmtTime = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000 && d.getDate() === now.getDate())
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  if (diff < 7 * 86400000) return d.toLocaleDateString('id-ID', { weekday: 'short' })
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

const Avatar = ({ name, url, emoji, online }: { name: string; url?: string; emoji?: string; online?: boolean }) => (
  <div style={{ position: 'relative', flexShrink: 0 }}>
    <div style={{
      width: 46, height: 46, borderRadius: '50%',
      background: 'var(--accent-light)', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: emoji ? 19 : 17, fontWeight: 700, color: 'var(--accent)',
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : emoji ? <span>{emoji}</span>
        : <span>{(name?.[0] ?? '?').toUpperCase()}</span>
      }
    </div>
    {online && (
      <span style={{
        position: 'absolute', right: 1, bottom: 1,
        width: 12, height: 12, borderRadius: '50%',
        background: 'var(--green, #22c55e)', border: '2.5px solid var(--bg2)',
      }} />
    )}
  </div>
)

export default function ConversationList({ currentUserId, onNewChat, onSelectConv, mobile }: Props) {
  const conversations = useChatStore(s => s.conversations)
  const currentConvId = useChatStore(s => s.currentConvId)
  const loading       = useChatStore(s => s.loading)
  const onlineUsers   = useChatStore(s => s.onlineUsers)
  const selectConv    = useChatStore(s => s.selectConv)
  const [query, setQuery] = useState('')

  const getOther = (conv: ChatConversation) =>
    conv.participant_a === currentUserId ? conv.profile_b : conv.profile_a

  const isOnline = (id?: string, lastSeen?: string | null) =>
    !!id && (onlineUsers[id] === true ||
      (!!lastSeen && Date.now() - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => {
      const o = getOther(c)
      return (o?.full_name?.toLowerCase().includes(q) || o?.username?.toLowerCase().includes(q))
    })
  }, [conversations, query, currentUserId])

  return (
    <div style={{
      width: mobile ? '100%' : 312, flexShrink: 0,
      borderRight: mobile ? 'none' : '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', background: 'var(--bg2)', minHeight: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--silver)', letterSpacing: '-0.3px' }}>Pesan</span>
          <button
            onClick={onNewChat}
            title="Chat Baru"
            style={{
              height: 32, padding: '0 12px 0 10px', background: 'var(--accent)',
              border: 'none', borderRadius: 9, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              color: 'white', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Baru
          </button>
        </div>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--silver4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari percakapan..."
            style={{
              width: '100%', height: 36, padding: '0 12px 0 34px', boxSizing: 'border-box',
              background: 'var(--bg4)', border: '1px solid var(--border2)',
              borderRadius: 10, fontSize: 13, color: 'var(--silver)',
              fontFamily: 'var(--font)', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* List */}
      <div className="chat-msglist" style={{ flex: 1, overflowY: 'auto', padding: '2px 8px 10px' }}>
        {loading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--silver4)', fontSize: 13 }}>
            Memuat...
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--silver4)', fontSize: 13 }}>
            Belum ada percakapan.<br />
            <button
              onClick={onNewChat}
              style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)' }}
            >Mulai chat baru</button>
          </div>
        )}
        {!loading && conversations.length > 0 && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--silver4)', fontSize: 13 }}>
            Tidak ada hasil untuk “{query}”.
          </div>
        )}
        {filtered.map(conv => {
          const other    = getOther(conv)
          const isActive = conv.id === currentConvId
          const unread   = conv.unread_count ?? 0
          const online   = isOnline(other?.id, other?.last_seen)
          return (
            <button
              key={conv.id}
              onClick={() => onSelectConv ? onSelectConv(conv.id) : selectConv(conv.id, currentUserId)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 10px', marginBottom: 2, border: 'none', borderRadius: 12,
                background: isActive ? 'var(--accent-light)' : 'none',
                cursor: 'pointer', textAlign: 'left', transition: 'background 120ms',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              <Avatar
                name={other?.full_name ?? '?'}
                url={other?.avatar_url ?? undefined}
                emoji={other?.avatar_emoji || other?.emoji || undefined}
                online={online}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 14, fontWeight: unread > 0 ? 800 : 600,
                    color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {other?.full_name ?? other?.username ?? 'Unknown'}
                  </span>
                  <span style={{ fontSize: 10.5, color: unread > 0 ? 'var(--accent)' : 'var(--silver4)', fontWeight: unread > 0 ? 700 : 400, flexShrink: 0 }}>
                    {fmtTime(conv.last_message_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 12,
                    color: online ? 'var(--green, #22c55e)' : 'var(--silver4)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {online ? 'online' : (other?.username ? `@${other.username}` : '')}
                  </span>
                  {unread > 0 && (
                    <span style={{
                      minWidth: 19, height: 19, borderRadius: 10,
                      background: 'var(--accent)', color: 'white',
                      fontSize: 10.5, fontWeight: 800, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                    }}>{unread > 99 ? '99+' : unread}</span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
