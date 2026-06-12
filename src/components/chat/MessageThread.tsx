import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useChatStore } from '../../store/chatStore'
import type { ChatConversation } from '../../utils/supabaseClient'
import { lastSeenText, ONLINE_WINDOW_MS } from '../../utils/presence'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

interface Props {
  conv:          ChatConversation
  currentUserId: string
  onBack?:       () => void   // mobile: render a back button + own header
}

const GROUP_GAP_MS = 5 * 60 * 1000

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date  = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff  = Math.round((today.getTime() - date.getTime()) / 86_400_000)
  if (diff === 0) return 'Hari ini'
  if (diff === 1) return 'Kemarin'
  return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function MessageThread({ conv, currentUserId, onBack }: Props) {
  // Narrow selectors → component only re-renders on what it uses.
  const messages    = useChatStore(s => s.messages)
  const msgLoading  = useChatStore(s => s.msgLoading)
  const peerTyping  = useChatStore(s => s.peerTyping)
  const encReady    = useChatStore(s => s.encReady)
  const onlineUsers = useChatStore(s => s.onlineUsers)
  const removeMsg   = useChatStore(s => s.removeMsg)
  const clearConv   = useChatStore(s => s.clearConv)
  const reactToMsg  = useChatStore(s => s.reactToMsg)
  const setReplyTo  = useChatStore(s => s.setReplyTo)
  const setEditing  = useChatStore(s => s.setEditing)
  const setForwarding = useChatStore(s => s.setForwarding)
  const starredIds  = useChatStore(s => s.starredIds)
  const toggleStar  = useChatStore(s => s.toggleStar)
  const lock        = useChatStore(s => s.lock)
  const unreadAnchorId = useChatStore(s => s.unreadAnchorId)
  const hasMoreOlder = useChatStore(s => s.hasMoreOlder)
  const loadingOlder = useChatStore(s => s.loadingOlder)
  const loadOlder    = useChatStore(s => s.loadOlder)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const listRef    = useRef<HTMLDivElement>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const atBottom   = useRef(true)
  const prevLen    = useRef(messages.length)
  const prevLastId = useRef<string | null>(null)
  const [showFab,      setShowFab]      = useState(false)
  const [newCount,     setNewCount]     = useState(0)
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [starredOpen,  setStarredOpen]  = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    setNewCount(0)
  }

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottom.current = dist < 120
    setShowFab(dist > 240)
    if (atBottom.current) setNewCount(0)

    // Near the top → load older history, preserving scroll position.
    if (el.scrollTop < 80 && hasMoreOlder && !loadingOlder) {
      const prevH = el.scrollHeight, prevTop = el.scrollTop
      loadOlder(currentUserId).then(n => {
        if (n > 0) requestAnimationFrame(() => {
          const e2 = listRef.current
          if (e2) e2.scrollTop = e2.scrollHeight - prevH + prevTop
        })
      })
    }
  }

  // Stick to bottom on a new message at the bottom; never on prepended history.
  useEffect(() => {
    const grew   = messages.length > prevLen.current
    prevLen.current = messages.length
    const lastId = messages.length ? messages[messages.length - 1].id : null
    const appended = grew && lastId !== prevLastId.current && prevLastId.current !== null
    prevLastId.current = lastId
    if (atBottom.current) scrollToBottom(true)
    else if (appended)    setNewCount(c => c + 1)
  }, [messages.length])

  // Jump to bottom when switching conversations.
  useEffect(() => {
    atBottom.current = true
    prevLastId.current = messages.length ? messages[messages.length - 1].id : null
    setShowFab(false); setNewCount(0); setMenuOpen(false); setConfirmClear(false)
    requestAnimationFrame(() => scrollToBottom(false))
  }, [conv.id])

  // When the keyboard opens (visible viewport shrinks), keep the latest
  // message in view if the user was already at the bottom.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onVV = () => { if (atBottom.current) requestAnimationFrame(() => scrollToBottom(false)) }
    vv.addEventListener('resize', onVV)
    return () => vv.removeEventListener('resize', onVV)
  }, [])

  const handleClear = async () => {
    if (!confirmClear) { setConfirmClear(true); return }
    await clearConv()
    setConfirmClear(false); setMenuOpen(false)
  }

  const onReact = useCallback(
    (id: string, emoji: string) => reactToMsg(id, emoji, currentUserId),
    [reactToMsg, currentUserId],
  )
  const onStar = useCallback((id: string) => toggleStar(id, currentUserId), [toggleStar, currentUserId])

  // Jump to a quoted message + flash it.
  const onQuoteJump = useCallback((id: string) => {
    const el = listRef.current?.querySelector(`[data-mid="${id}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(id)
    setTimeout(() => setHighlightId(null), 1300)
  }, [])

  const other = conv.participant_a === currentUserId ? conv.profile_b : conv.profile_a
  const otherName = other?.full_name ?? other?.username ?? 'Pesan'

  // Fast id → message lookup for resolving reply quotes.
  const byId = useMemo(() => {
    const m = new Map<string, typeof messages[number]>()
    for (const x of messages) m.set(x.id, x)
    return m
  }, [messages])
  const otherId = other?.id
  const isOnline = !!otherId && (
    onlineUsers[otherId] === true ||
    (!!other?.last_seen && Date.now() - new Date(other.last_seen).getTime() < ONLINE_WINDOW_MS)
  )
  const statusText = isOnline ? 'online' : lastSeenText(other?.last_seen)

  // Flatten into render rows with date separators + sender grouping.
  const rows = useMemo(() => {
    const out: Array<{ msg: typeof messages[number]; day: string; showDate: boolean; cont: boolean }> = []
    let prev: typeof messages[number] | null = null
    const seen = new Set<string>()
    for (const m of messages) {
      if (seen.has(m.id)) continue   // safety net: never render a message twice
      seen.add(m.id)
      const day = m.created_at.slice(0, 10)
      const showDate = !prev || prev.created_at.slice(0, 10) !== day
      const cont = !showDate && !!prev && prev.sender_id === m.sender_id &&
        (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_GAP_MS)
      out.push({ msg: m, day, showDate, cont })
      prev = m
    }
    return out
  }, [messages])

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      minWidth: 0, minHeight: 0, background: 'var(--bg)', position: 'relative',
    }}>
      {/* Thread header — fixed; only the message list below scrolls */}
      <div style={{
        flexShrink: 0,
        padding: '9px 10px 9px 8px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)',
        display: 'flex', alignItems: 'center', gap: 10, position: 'relative',
      }}>
        {onBack && (
          <button
            onClick={onBack}
            title="Kembali"
            style={{
              width: 34, height: 34, flexShrink: 0, background: 'none', border: 'none',
              cursor: 'pointer', borderRadius: 8, color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        <div style={{ position: 'relative', flexShrink: 0, marginLeft: onBack ? 0 : 6 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'var(--accent-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: other?.avatar_emoji || other?.emoji ? 17 : 15,
            fontWeight: 700, color: 'var(--accent)', overflow: 'hidden',
          }}>
            {other?.avatar_url
              ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : other?.avatar_emoji || other?.emoji
              ? <span>{other.avatar_emoji || other.emoji}</span>
              : <span>{(other?.full_name?.[0] ?? '?').toUpperCase()}</span>
            }
          </div>
          {isOnline && (
            <span style={{
              position: 'absolute', right: -1, bottom: -1,
              width: 11, height: 11, borderRadius: '50%',
              background: 'var(--green, #22c55e)', border: '2px solid var(--bg2)',
            }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {other?.full_name ?? other?.username ?? 'Unknown'}
          </div>
          <div style={{
            fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
            color: peerTyping ? 'var(--accent)' : isOnline ? 'var(--green, #22c55e)' : 'var(--silver4)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontWeight: peerTyping ? 600 : 400, minHeight: 14,
          }}>
            {peerTyping ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                mengetik
                <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'typingDot 1.2s infinite', animationDelay: `${i * 0.18}s` }} />
                  ))}
                </span>
              </span>
            ) : (statusText || (other?.username ? `@${other.username}` : ''))}
          </div>
        </div>

        {/* Kebab menu */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          title="Opsi"
          style={{
            width: 34, height: 34, flexShrink: 0,
            background: menuOpen ? 'var(--bg3)' : 'none', border: 'none',
            borderRadius: 8, cursor: 'pointer', color: 'var(--silver3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
        </button>
        {menuOpen && (
          <>
            <div onClick={() => { setMenuOpen(false); setConfirmClear(false) }} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
            <div style={{
              position: 'absolute', top: 50, right: 12, zIndex: 50,
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 10, padding: 4, minWidth: 170,
              boxShadow: 'var(--shadow-lg)', animation: 'popIn 120ms ease',
            }}>
              <button
                onClick={() => { setMenuOpen(false); setStarredOpen(true) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 11px', background: 'none', border: 'none',
                  borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                  color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', fontWeight: 500,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Pesan berbintang
              </button>
              <button
                onClick={handleClear}
                onMouseLeave={() => { if (confirmClear) setTimeout(() => setConfirmClear(false), 2500) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 11px', background: 'none', border: 'none',
                  borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                  color: confirmClear ? 'var(--red)' : 'var(--silver)', fontSize: 13,
                  fontFamily: 'var(--font)', fontWeight: confirmClear ? 700 : 500,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                {confirmClear ? 'Yakin bersihkan?' : 'Bersihkan chat'}
              </button>
              <button
                onClick={() => { setMenuOpen(false); lock() }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 11px', background: 'none', border: 'none',
                  borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                  color: 'var(--silver)', fontSize: 13, fontFamily: 'var(--font)', fontWeight: 500,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Kunci chat
              </button>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        onScroll={onScroll}
        className="chat-msglist chat-wallpaper"
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y', padding: '14px 16px 10px', position: 'relative',
        }}
      >
        {loadingOlder && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px' }}>
            <span style={{ width: 20, height: 20, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
          </div>
        )}
        {encReady && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
            margin: '0 auto 14px', maxWidth: 440, padding: '6px 12px',
            background: 'color-mix(in srgb, var(--accent) 10%, var(--bg2))',
            border: '1px solid var(--border)', borderRadius: 10,
            fontSize: 10.5, color: 'var(--silver3)', textAlign: 'center',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Pesan teks diamankan dengan enkripsi end-to-end
          </div>
        )}

        {msgLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
            {[{ m: false, w: 150 }, { m: false, w: 104 }, { m: true, w: 188 }, { m: false, w: 132 }, { m: true, w: 96 }, { m: true, w: 152 }].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: r.m ? 'flex-end' : 'flex-start' }}>
                <div className="chat-skeleton" style={{ width: r.w, height: 36, borderRadius: r.m ? '16px 5px 16px 16px' : '5px 16px 16px 16px' }} />
              </div>
            ))}
          </div>
        )}
        {!msgLoading && messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--silver4)', textAlign: 'center', gap: 10, padding: 24,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--bg2)',
              border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--silver4)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--silver3)' }}>Belum ada pesan</div>
            <div style={{ fontSize: 12 }}>Sapa {other?.full_name?.split(' ')[0] ?? 'mereka'} dengan pesan pertama 👋</div>
          </div>
        )}

        {rows.map(({ msg, day, showDate, cont }) => (
          <div key={msg.id} data-mid={msg.id} className={highlightId === msg.id ? 'chat-quote-flash' : undefined}>
            {msg.id === unreadAnchorId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 10px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--accent)', opacity: 0.35 }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  Pesan belum dibaca
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--accent)', opacity: 0.35 }} />
              </div>
            )}
            {showDate && (
              <div style={{
                display: 'flex', justifyContent: 'center', margin: '14px 0 10px',
                position: 'sticky', top: 4, zIndex: 3, pointerEvents: 'none',
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--silver3)',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,.10)',
                }}>{fmtDate(day)}</span>
              </div>
            )}
            <MessageBubble
              msg={msg}
              isMine={msg.sender_id === currentUserId}
              currentUserId={currentUserId}
              cont={cont}
              starred={!!starredIds[msg.id]}
              quoted={msg.reply_to ? (byId.get(msg.reply_to) ?? null) : null}
              quotedName={otherName}
              onDelete={removeMsg}
              onReact={onReact}
              onReply={setReplyTo}
              onEdit={setEditing}
              onForward={setForwarding}
              onStar={onStar}
              onQuoteJump={onQuoteJump}
            />
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom FAB (+ new-message badge) */}
      {(showFab || newCount > 0) && (
        <button
          onClick={() => scrollToBottom(true)}
          title="Ke pesan terbaru"
          style={{
            position: 'absolute', right: 18, bottom: 84, zIndex: 5,
            height: 40, minWidth: 40, padding: newCount > 0 ? '0 14px 0 12px' : 0,
            borderRadius: 20, gap: 6,
            background: newCount > 0 ? 'var(--accent)' : 'var(--bg2)',
            border: newCount > 0 ? 'none' : '1px solid var(--border2)',
            boxShadow: 'var(--shadow-lg)', cursor: 'pointer',
            color: newCount > 0 ? 'white' : 'var(--silver)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)',
            animation: 'popIn 140ms ease',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          {newCount > 0 && <span>{newCount} pesan baru</span>}
        </button>
      )}

      {/* Starred messages */}
      {starredOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setStarredOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 18, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', animation: 'fadeUp 180ms ease' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--silver)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#F5B301" stroke="#F5B301" strokeWidth="2" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Pesan berbintang
              </span>
              <button onClick={() => setStarredOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div className="chat-msglist" style={{ flex: 1, overflowY: 'auto', padding: '6px 8px 12px' }}>
              {messages.filter(m => starredIds[m.id]).length === 0 && (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--silver4)', fontSize: 13 }}>Belum ada pesan berbintang di percakapan ini.</div>
              )}
              {messages.filter(m => starredIds[m.id]).map(m => (
                <button
                  key={m.id}
                  onClick={() => { setStarredOpen(false); onQuoteJump(m.id) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 11px', border: 'none', borderRadius: 10, background: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)' }}>
                      {m.sender_id === currentUserId ? 'Anda' : otherName}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.message_type === 'text' ? m.content : m.message_type === 'image' ? '📷 Foto' : m.message_type === 'video' ? '🎬 Video' : m.message_type === 'audio' ? '🎵 Pesan suara' : '📎 ' + (m.file_name ?? 'File')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <ChatInput senderId={currentUserId} otherName={otherName} />
    </div>
  )
}
