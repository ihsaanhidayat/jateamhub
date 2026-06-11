import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import type { ChatConversation } from '../../utils/supabaseClient'
import { lastSeenText, ONLINE_WINDOW_MS } from '../../utils/presence'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

interface Props {
  conv:          ChatConversation
  currentUserId: string
}

const fmtDate = (iso: string) => {
  // Parse YYYY-MM-DD as local time (not UTC) to avoid off-by-one in UTC+ timezones
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function MessageThread({ conv, currentUserId }: Props) {
  const { messages, msgLoading, removeMsg, clearConv, reactToMsg, resetIdle, onlineUsers, encReady, peerTyping } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, peerTyping])

  const handleClear = async () => {
    if (!confirmClear) { setConfirmClear(true); return }
    await clearConv()
    setConfirmClear(false)
  }

  const other = conv.participant_a === currentUserId ? conv.profile_b : conv.profile_a
  const otherId = other?.id
  const isOnline = !!otherId && (
    onlineUsers[otherId] === true ||
    (!!other?.last_seen && Date.now() - new Date(other.last_seen).getTime() < ONLINE_WINDOW_MS)
  )
  const statusText = isOnline ? 'online' : lastSeenText(other?.last_seen)

  // Group messages by date
  const groups: Array<{ date: string; msgs: typeof messages }> = []
  for (const msg of messages) {
    const d = msg.created_at.slice(0, 10)
    const last = groups[groups.length - 1]
    if (last?.date === d) last.msgs.push(msg)
    else groups.push({ date: d, msgs: [msg] })
  }

  return (
    <div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        background: 'var(--bg)',
      }}
      onPointerMove={resetIdle}
      onKeyDown={resetIdle}
    >
      {/* Thread header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--accent-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: other?.avatar_emoji || other?.emoji ? 16 : 14,
          fontWeight: 700, color: 'var(--accent)', flexShrink: 0, overflow: 'hidden',
        }}>
          {other?.avatar_url
            ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : other?.avatar_emoji || other?.emoji
            ? <span>{other.avatar_emoji || other.emoji}</span>
            : <span>{(other?.full_name?.[0] ?? '?').toUpperCase()}</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {other?.full_name ?? other?.username ?? 'Unknown'}
          </div>
          <div style={{
            fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
            color: peerTyping ? 'var(--accent)' : isOnline ? 'var(--green, #22c55e)' : 'var(--silver4)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontWeight: peerTyping ? 600 : 400,
          }}>
            {!peerTyping && isOnline && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green, #22c55e)', flexShrink: 0 }} />
            )}
            {peerTyping ? 'mengetik…' : (statusText || (other?.username ? `@${other.username}` : ''))}
          </div>
        </div>
        {/* Clear chat button */}
        <button
          onClick={handleClear}
          title={confirmClear ? 'Klik lagi untuk konfirmasi' : 'Hapus semua pesan'}
          style={{
            background: confirmClear ? 'var(--red)' : 'none',
            border: '1px solid ' + (confirmClear ? 'var(--red)' : 'var(--border2)'),
            borderRadius: 8, padding: '5px 10px',
            fontSize: 11, color: confirmClear ? 'white' : 'var(--silver4)',
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            transition: 'all 150ms',
          }}
          onMouseLeave={() => { if (confirmClear) setTimeout(() => setConfirmClear(false), 2000) }}
        >
          {confirmClear ? 'Yakin hapus?' : 'Hapus chat'}
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {encReady && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
            margin: '0 auto 12px', maxWidth: 420, padding: '6px 12px',
            background: 'color-mix(in srgb, var(--accent) 9%, transparent)',
            borderRadius: 8, fontSize: 10.5, color: 'var(--silver4)', textAlign: 'center',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Pesan teks diamankan dengan enkripsi end-to-end
          </div>
        )}
        {msgLoading && (
          <div style={{ textAlign: 'center', color: 'var(--silver4)', fontSize: 13, padding: 20 }}>
            Memuat pesan...
          </div>
        )}
        {!msgLoading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--silver4)', fontSize: 13, padding: 40 }}>
            Belum ada pesan. Kirim yang pertama!
          </div>
        )}
        {groups.map(({ date, msgs }) => (
          <div key={date}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 8px',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{
                fontSize: 11, color: 'var(--silver4)', fontFamily: 'var(--mono)',
                background: 'var(--bg)', padding: '0 8px', whiteSpace: 'nowrap',
              }}>{fmtDate(date)}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            {msgs.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isMine={msg.sender_id === currentUserId}
                currentUserId={currentUserId}
                onDelete={removeMsg}
                onReact={(id, emoji) => reactToMsg(id, emoji, currentUserId)}
              />
            ))}
          </div>
        ))}
        {peerTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--bg4)', borderRadius: '4px 16px 16px 16px',
              padding: '11px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.18)',
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--silver4)',
                  display: 'inline-block', animation: 'typingDot 1.2s infinite',
                  animationDelay: `${i * 0.18}s`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput senderId={currentUserId} />
    </div>
  )
}
