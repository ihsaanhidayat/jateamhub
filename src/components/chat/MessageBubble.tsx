import { useState, useEffect, useRef, memo } from 'react'
import type { ChatMessage } from '../../utils/supabaseClient'
import { QUICK_REACTIONS } from './emojiData'
import { linkify, emojiOnlyCount, messagePreview } from '../../utils/chatText'
import AudioMessage from './AudioMessage'

interface Props {
  msg:            ChatMessage
  isMine:         boolean
  currentUserId?: string
  cont?:          boolean    // continuation of the same sender's group
  starred?:       boolean    // bookmarked by me
  quoted?:        ChatMessage | null   // resolved message this one replies to
  quotedName?:    string               // display name of the quoted sender
  onDelete?:      (id: string) => void
  onReact?:       (id: string, emoji: string) => void
  onReply?:       (msg: ChatMessage) => void
  onEdit?:        (msg: ChatMessage) => void
  onForward?:     (msg: ChatMessage) => void
  onStar?:        (id: string) => void
  onQuoteJump?:   (id: string) => void
}

const EDIT_WINDOW_MS = 15 * 60 * 1000

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 20,
          background: 'rgba(255,255,255,0.12)', border: 'none',
          borderRadius: '50%', width: 38, height: 38,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'white', fontSize: 22, lineHeight: 1,
        }}
        aria-label="Tutup"
      >×</button>
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 'min(90vw, 1200px)', maxHeight: '90vh',
          objectFit: 'contain', borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          cursor: 'default',
        }}
      />
    </div>
  )
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

// WhatsApp-style delivery ticks.
//  · sent      → single check (translucent)
//  · delivered → double check (translucent)
//  · read      → double check (blue)
function Ticks({ delivered, read, light }: { delivered: boolean; read: boolean; light?: boolean }) {
  const color  = read ? '#53BDEB' : light ? 'var(--silver4)' : 'rgba(255,255,255,0.72)'
  const double = delivered || read
  const check  = (ox: number) =>
    <path d={`M${ox} 5.6 L${ox + 3.1} 8.7 L${ox + 8.4} 2.1`}
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  return (
    <svg width={double ? 17 : 12} height="11" viewBox={`0 0 ${double ? 17 : 12} 11`} style={{ display: 'block' }}>
      {check(0.6)}
      {double && check(5.4)}
    </svg>
  )
}

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const FileIcon = ({ name }: { name: string }) => {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const icons: Record<string, string> = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    ppt: '📑', pptx: '📑', zip: '🗜️', rar: '🗜️', mp3: '🎵',
    mp4: '🎬', webm: '🎬', ogg: '🎵',
  }
  return <span style={{ fontSize: 22 }}>{icons[ext] ?? '📎'}</span>
}

function MessageBubble({ msg, isMine, currentUserId, cont, starred, quoted, quotedName, onDelete, onReact, onReply, onEdit, onForward, onStar, onQuoteJump }: Props) {
  const [showInfo,    setShowInfo]    = useState(false)
  const [showReact,   setShowReact]   = useState(false)
  const [hover,       setHover]       = useState(false)
  const [heartFx,     setHeartFx]     = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const hintRef   = useRef<HTMLDivElement>(null)
  const touch     = useRef({ x0: 0, y0: 0, dx: 0, active: false, decided: false, horizontal: false })

  const emojiCount = msg.message_type === 'text' && msg.content && !msg.reply_to ? emojiOnlyCount(msg.content) : 0
  const isBig   = emojiCount > 0 && emojiCount <= 3
  const isMedia = msg.message_type === 'image' || msg.message_type === 'video'
  const hasCaption = isMedia && !!msg.content
  const bg      = isBig ? 'transparent' : isMine ? 'var(--accent)' : 'var(--bg2)'
  const textCol = isBig ? 'var(--silver)' : isMine ? 'white' : 'var(--silver)'

  const heartReact = () => {
    if (!onReact) return
    onReact(msg.id, '❤️')
    setHeartFx(true)
    setTimeout(() => setHeartFx(false), 700)
  }

  const canEdit = isMine && msg.message_type === 'text' && !!onEdit &&
    (Date.now() - new Date(msg.created_at).getTime() < EDIT_WINDOW_MS)

  // Corner radii — tail on the first bubble of a group, tighter when continued.
  const radius = isMine
    ? (cont ? '16px 8px 8px 16px' : '16px 5px 16px 16px')
    : (cont ? '8px 16px 16px 8px' : '5px 16px 16px 16px')

  const reactions = msg.reactions ?? {}
  const reactionEntries = Object.entries(reactions).filter(([, u]) => u.length > 0)

  const doReact = (emoji: string) => { onReact?.(msg.id, emoji); setShowReact(false) }

  const startLongPress = () => {
    if (!onReact) return
    longPress.current = setTimeout(() => setShowReact(true), 420)
  }
  const cancelLongPress = () => { if (longPress.current) { clearTimeout(longPress.current); longPress.current = null } }

  // Swipe-right-to-reply (mobile)
  const SWIPE_TRIGGER = 56, SWIPE_MAX = 74
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x0: t.clientX, y0: t.clientY, dx: 0, active: true, decided: false, horizontal: false }
    startLongPress()
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const tc = touch.current
    if (!tc.active) return
    const t = e.touches[0]
    const dx = t.clientX - tc.x0, dy = t.clientY - tc.y0
    if (!tc.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      tc.decided = true
      tc.horizontal = Math.abs(dx) > Math.abs(dy) && dx > 0 && !!onReply
    }
    cancelLongPress()
    if (!tc.horizontal) return
    const clamped = Math.max(0, Math.min(dx, SWIPE_MAX))
    tc.dx = clamped
    if (bubbleRef.current) bubbleRef.current.style.transform = `translateX(${clamped}px)`
    if (hintRef.current) hintRef.current.style.opacity = String(Math.min(clamped / SWIPE_TRIGGER, 1))
  }
  const onTouchEnd = () => {
    const tc = touch.current
    if (tc.horizontal) {
      if (tc.dx >= SWIPE_TRIGGER && onReply) onReply(msg)
      if (bubbleRef.current) {
        bubbleRef.current.style.transition = 'transform 180ms ease'
        bubbleRef.current.style.transform = 'translateX(0)'
        setTimeout(() => { if (bubbleRef.current) bubbleRef.current.style.transition = '' }, 200)
      }
      if (hintRef.current) hintRef.current.style.opacity = '0'
    }
    cancelLongPress()
    tc.active = false
  }

  return (
    <div
      className="chat-bubble-in"
      style={{
        display: 'flex',
        flexDirection: isMine ? 'row-reverse' : 'row',
        gap: 6, marginTop: cont ? 2 : 9,
        marginBottom: reactionEntries.length ? 14 : 0,
        alignItems: 'flex-end', position: 'relative',
      }}
      onClick={() => { setShowInfo(false); setShowReact(false) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setShowReact(false) }}
    >
      {/* Swipe-to-reply hint */}
      {onReply && (
        <div
          ref={hintRef}
          style={{
            position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
            width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)', opacity: 0, pointerEvents: 'none', zIndex: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
        </div>
      )}
      <div
        style={{
          maxWidth: '74%', minWidth: isBig ? 0 : 72,
          background: bg, color: textCol,
          borderRadius: isBig ? 0 : radius,
          padding: isBig ? '1px 2px' : isMedia ? 4 : msg.message_type === 'text' ? '7px 11px 6px' : 5,
          fontSize: 14, lineHeight: 1.45,
          boxShadow: isBig ? 'none' : isMine ? '0 1px 1.5px rgba(0,0,0,.12)' : '0 1px 2px rgba(0,0,0,.10)',
          border: isBig ? 'none' : isMine ? 'none' : '1px solid var(--border)',
          position: 'relative', cursor: 'default',
          wordBreak: 'break-word',
        }}
        ref={bubbleRef}
        onContextMenu={e => { e.preventDefault(); if (onReact) setShowReact(v => !v) }}
        onDoubleClick={() => heartReact()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
      >
        {heartFx && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 10, fontSize: 40,
            animation: 'heartPop 700ms ease',
          }}>❤️</div>
        )}
        {/* Quick-reaction bar */}
        {showReact && onReact && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: '100%', marginBottom: 7,
              [isMine ? 'right' : 'left']: 0,
              display: 'flex', alignItems: 'center', gap: 2, padding: 4,
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 22, boxShadow: 'var(--shadow-lg)', zIndex: 55,
              animation: 'popIn 130ms ease',
            }}
          >
            {onReply && (
              <button
                onClick={() => { onReply(msg); setShowReact(false) }}
                title="Balas"
                style={{
                  width: 34, height: 34, marginRight: 2, background: 'none', border: 'none',
                  borderRight: '1px solid var(--border)', borderRadius: 0, cursor: 'pointer',
                  color: 'var(--silver2, var(--silver))', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
              </button>
            )}
            {QUICK_REACTIONS.map(emoji => {
              const mine = !!currentUserId && (reactions[emoji]?.includes(currentUserId) ?? false)
              return (
                <button
                  key={emoji}
                  onClick={() => doReact(emoji)}
                  style={{
                    width: 34, height: 34, fontSize: 20, lineHeight: 1,
                    background: mine ? 'var(--accent-light)' : 'none',
                    border: 'none', borderRadius: '50%', cursor: 'pointer',
                    transition: 'transform 100ms, background 100ms',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.25)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
                >{emoji}</button>
              )
            })}
            {onForward && msg.message_type !== 'audio' && (
              <button
                onClick={() => { onForward(msg); setShowReact(false) }}
                title="Teruskan"
                style={{
                  width: 34, height: 34, marginLeft: 2,
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderLeft: '1px solid var(--border)', borderRadius: 0,
                  color: 'var(--silver2, var(--silver))', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
              </button>
            )}
            {onStar && (
              <button
                onClick={() => { onStar(msg.id); setShowReact(false) }}
                title={starred ? 'Hapus bintang' : 'Beri bintang'}
                style={{
                  width: 34, height: 34, marginLeft: 2,
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderLeft: '1px solid var(--border)', borderRadius: 0,
                  color: starred ? '#F5B301' : 'var(--silver2, var(--silver))', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill={starred ? '#F5B301' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => { onEdit!(msg); setShowReact(false) }}
                title="Edit pesan"
                style={{
                  width: 34, height: 34, marginLeft: 2,
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderLeft: '1px solid var(--border)', borderRadius: 0,
                  color: 'var(--silver2, var(--silver))', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
            )}
            {isMine && onDelete && (
              <button
                onClick={() => { onDelete(msg.id); setShowReact(false) }}
                title="Hapus pesan"
                style={{
                  width: 34, height: 34, marginLeft: canEdit ? 0 : 2,
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderLeft: '1px solid var(--border)', borderRadius: 0,
                  color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            )}
          </div>
        )}

        {/* Forwarded indicator */}
        {msg.is_forwarded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3, fontSize: 11, fontStyle: 'italic', opacity: 0.75, color: isMine ? 'rgba(255,255,255,0.92)' : 'var(--silver4)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>
            Diteruskan
          </div>
        )}

        {/* Quoted (reply) block */}
        {msg.reply_to && (
          <div
            onClick={e => { e.stopPropagation(); if (quoted) onQuoteJump?.(quoted.id) }}
            style={{
              marginBottom: 5, cursor: quoted ? 'pointer' : 'default', overflow: 'hidden',
              background: isMine ? 'rgba(255,255,255,0.16)' : 'var(--bg4)',
              borderRadius: 8, padding: '5px 9px',
              borderLeft: '3px solid ' + (isMine ? 'rgba(255,255,255,0.75)' : 'var(--accent)'),
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, color: isMine ? 'white' : 'var(--accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {quoted ? (quoted.sender_id === currentUserId ? 'Anda' : (quotedName ?? 'Pesan')) : 'Pesan'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
              {quoted ? messagePreview(quoted) : 'Pesan tidak tersedia'}
            </div>
          </div>
        )}

        {msg.message_type === 'text' && (
          isBig
            ? <span style={{ fontSize: emojiCount === 1 ? 48 : emojiCount === 2 ? 40 : 32, lineHeight: 1.15, display: 'block' }}>{msg.content}</span>
            : <span style={{ whiteSpace: 'pre-wrap' }}>{linkify(msg.content ?? '')}</span>
        )}

        {msg.message_type === 'image' && msg.file_url && (
          <img
            src={msg.file_url}
            alt={msg.file_name ?? 'image'}
            onClick={e => { e.stopPropagation(); setLightboxSrc(msg.file_url) }}
            style={{
              maxWidth: '100%', maxHeight: 300, borderRadius: 13,
              display: 'block', objectFit: 'cover', cursor: 'zoom-in',
            }}
          />
        )}

        {msg.message_type === 'video' && msg.file_url && (
          <video
            src={msg.file_url}
            controls
            style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 13, display: 'block' }}
          />
        )}

        {hasCaption && (
          <div style={{ padding: '5px 7px 1px', fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', color: textCol }}>
            {linkify(msg.content ?? '')}
          </div>
        )}

        {msg.message_type === 'audio' && msg.file_url && (
          <AudioMessage src={msg.file_url} isMine={isMine} />
        )}

        {msg.message_type === 'document' && msg.file_url && (
          <a
            href={msg.file_url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px',
              color: textCol, textDecoration: 'none',
            }}
          >
            <span style={{
              width: 38, height: 38, flexShrink: 0, borderRadius: 10,
              background: isMine ? 'rgba(255,255,255,0.18)' : 'var(--bg4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileIcon name={msg.file_name ?? ''} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>
                {msg.file_name ?? 'File'}
              </div>
              {msg.file_size && (
                <div style={{ fontSize: 11, opacity: 0.7 }}>{fmtSize(msg.file_size)} · Unduh</div>
              )}
            </div>
          </a>
        )}

        {/* Meta: time + ticks (overlaid on media) */}
        <div
          onClick={e => { if (isMine) { e.stopPropagation(); setShowInfo(v => !v) } }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            justifyContent: isMine ? 'flex-end' : 'flex-start',
            cursor: isMine ? 'pointer' : 'default',
            ...(isMedia && !hasCaption ? {
              position: 'absolute', right: 8, bottom: 8,
              padding: '2px 7px', borderRadius: 10,
              background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(2px)',
              color: 'white',
            } : {
              marginTop: 2, color: isBig ? 'var(--silver4)' : isMine ? 'rgba(255,255,255,0.85)' : 'var(--silver4)',
            }),
            fontSize: 10, lineHeight: 1.4,
          }}
        >
          {starred && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#F5B301" stroke="#F5B301" strokeWidth="2" strokeLinejoin="round" style={{ flexShrink: 0 }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          )}
          {msg.edited_at && <span style={{ opacity: 0.7, fontStyle: 'italic' }}>diedit</span>}
          <span style={{ opacity: isMedia ? 0.95 : 0.8 }}>{fmtTime(msg.created_at)}</span>
          {isMine && <Ticks delivered={!!msg.delivered_at} read={!!msg.read_at} light={isBig} />}
        </div>

        {showInfo && isMine && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 4,
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 10, padding: '8px 12px',
            boxShadow: 'var(--shadow-lg)', minWidth: 150, animation: 'popIn 120ms ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 11, color: 'var(--silver3)', padding: '2px 0' }}>
              <span>Terkirim</span><span style={{ fontFamily: 'var(--mono)' }}>{fmtTime(msg.created_at)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 11, color: msg.delivered_at ? 'var(--silver3)' : 'var(--silver4)', padding: '2px 0' }}>
              <span>Diterima</span><span style={{ fontFamily: 'var(--mono)' }}>{msg.delivered_at ? fmtTime(msg.delivered_at) : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 11, color: msg.read_at ? '#53BDEB' : 'var(--silver4)', padding: '2px 0' }}>
              <span>Dibaca</span><span style={{ fontFamily: 'var(--mono)' }}>{msg.read_at ? fmtTime(msg.read_at) : '—'}</span>
            </div>
          </div>
        )}

        {/* Reaction chips — pinned to the bubble's bottom edge */}
        {reactionEntries.length > 0 && (
          <div style={{
            position: 'absolute', bottom: -13, [isMine ? 'right' : 'left']: 6,
            display: 'flex', gap: 3, zIndex: 2,
          }}>
            {reactionEntries.map(([emoji, users]) => {
              const mine = !!currentUserId && users.includes(currentUserId)
              return (
                <button
                  key={emoji}
                  onClick={e => { e.stopPropagation(); doReact(emoji) }}
                  title={`${users.length} reaksi`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    height: 22, padding: '0 6px', borderRadius: 11,
                    background: mine ? 'var(--accent-light)' : 'var(--bg2)',
                    border: '1px solid ' + (mine ? 'var(--accent)' : 'var(--border2)'),
                    cursor: 'pointer', fontSize: 12, lineHeight: 1,
                    boxShadow: '0 1px 3px rgba(0,0,0,.18)',
                  }}
                >
                  <span>{emoji}</span>
                  {users.length > 1 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: mine ? 'var(--accent)' : 'var(--silver3)' }}>{users.length}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Hover triggers (desktop): reply + react */}
      {hover && !showReact && (onReact || onReply) && (
        <div style={{ display: 'flex', gap: 4, alignSelf: 'center', flexShrink: 0 }}>
          {onReply && (
            <button
              onClick={e => { e.stopPropagation(); onReply(msg) }}
              title="Balas"
              style={{
                width: 28, height: 28, background: 'var(--bg2)', border: '1px solid var(--border2)',
                borderRadius: '50%', cursor: 'pointer', color: 'var(--silver3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
            </button>
          )}
          {onReact && (
            <button
              onClick={e => { e.stopPropagation(); setShowReact(true) }}
              title="Beri reaksi"
              style={{
                width: 28, height: 28, background: 'var(--bg2)', border: '1px solid var(--border2)',
                borderRadius: '50%', cursor: 'pointer', color: 'var(--silver3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>
          )}
        </div>
      )}

      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt={msg.file_name ?? 'image'}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  )
}

export default memo(MessageBubble)
