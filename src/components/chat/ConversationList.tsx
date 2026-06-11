import { useChatStore } from '../../store/chatStore'
import type { ChatConversation } from '../../utils/supabaseClient'

interface Props {
  currentUserId: string
  onNewChat:     () => void
  onSelectConv?: (id: string) => void
}

const fmtTime = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

const Avatar = ({ name, url, emoji }: { name: string; url?: string; emoji?: string }) => (
  <div style={{
    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
    background: 'var(--accent-light)', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: emoji ? 18 : 16, fontWeight: 700, color: 'var(--accent)',
  }}>
    {url
      ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : emoji ? <span>{emoji}</span>
      : <span>{(name?.[0] ?? '?').toUpperCase()}</span>
    }
  </div>
)

export default function ConversationList({ currentUserId, onNewChat, onSelectConv }: Props) {
  const { conversations, currentConvId, selectConv, loading } = useChatStore()

  const getOther = (conv: ChatConversation) =>
    conv.participant_a === currentUserId ? conv.profile_b : conv.profile_a

  return (
    <div style={{
      width: 280, flexShrink: 0, borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', background: 'var(--bg2)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--silver)' }}>Pesan</span>
        <button
          onClick={onNewChat}
          title="Chat Baru"
          style={{
            width: 30, height: 30, background: 'var(--accent)',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 18, fontWeight: 700,
          }}
        >+</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--silver4)', fontSize: 13 }}>
            Memuat...
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--silver4)', fontSize: 13 }}>
            Belum ada percakapan.<br />
            <button
              onClick={onNewChat}
              style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font)' }}
            >Mulai chat baru</button>
          </div>
        )}
        {conversations.map(conv => {
          const other   = getOther(conv)
          const isActive = conv.id === currentConvId
          const unread   = conv.unread_count ?? 0
          return (
            <button
              key={conv.id}
              onClick={() => { selectConv(conv.id, currentUserId); onSelectConv?.(conv.id) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', border: 'none',
                background: isActive ? 'var(--accent-light)' : 'none',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 100ms',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg3)' }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              <Avatar
                name={other?.full_name ?? '?'}
                url={other?.avatar_url ?? undefined}
                emoji={other?.avatar_emoji || other?.emoji || undefined}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: unread > 0 ? 700 : 500,
                  color: 'var(--silver)', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {other?.full_name ?? other?.username ?? 'Unknown'}
                </div>
                <div style={{
                  fontSize: 11, color: 'var(--silver4)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {other?.username ? `@${other.username}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: 'var(--silver4)' }}>{fmtTime(conv.last_message_at)}</span>
                {unread > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9,
                    background: 'var(--accent)', color: 'white',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px',
                  }}>{unread}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
