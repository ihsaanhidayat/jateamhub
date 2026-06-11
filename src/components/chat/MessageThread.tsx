import { useEffect, useRef } from 'react'
import { useChatStore } from '../../store/chatStore'
import type { ChatConversation } from '../../utils/supabaseClient'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

interface Props {
  conv:          ChatConversation
  currentUserId: string
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })

export default function MessageThread({ conv, currentUserId }: Props) {
  const { messages, msgLoading, removeMsg } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const other = conv.participant_a === currentUserId ? conv.profile_b : conv.profile_a

  // Group messages by date
  const groups: Array<{ date: string; msgs: typeof messages }> = []
  for (const msg of messages) {
    const d = msg.created_at.slice(0, 10)
    const last = groups[groups.length - 1]
    if (last?.date === d) last.msgs.push(msg)
    else groups.push({ date: d, msgs: [msg] })
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
      background: 'var(--bg)',
    }}>
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
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--silver)' }}>
            {other?.full_name ?? other?.username ?? 'Unknown'}
          </div>
          {other?.username && (
            <div style={{ fontSize: 11, color: 'var(--silver4)' }}>@{other.username}</div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
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
                onDelete={removeMsg}
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <ChatInput senderId={currentUserId} />
    </div>
  )
}
