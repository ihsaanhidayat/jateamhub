import { useState, useEffect, useRef } from 'react'
import type { ChatMessage } from '../../utils/supabaseClient'
import { QUICK_REACTIONS } from './emojiData'

interface Props {
  msg:           ChatMessage
  isMine:        boolean
  currentUserId?: string
  onDelete?:     (id: string) => void
  onReact?:      (id: string, emoji: string) => void
}

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
function Ticks({ delivered, read }: { delivered: boolean; read: boolean }) {
  const color  = read ? '#53BDEB' : 'rgba(255,255,255,0.72)'
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
  return <span style={{ fontSize: 20 }}>{icons[ext] ?? '📎'}</span>
}

export default function MessageBubble({ msg, isMine, currentUserId, onDelete, onReact }: Props) {
  const [showMenu,    setShowMenu]    = useState(false)
  const [showInfo,    setShowInfo]    = useState(false)
  const [showReact,   setShowReact]   = useState(false)
  const [hover,       setHover]       = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null)
  const accent  = isMine ? 'var(--accent)' : 'var(--bg4)'
  const textCol = isMine ? 'white' : 'var(--silver)'

  const reactions = msg.reactions ?? {}
  const reactionEntries = Object.entries(reactions).filter(([, u]) => u.length > 0)

  const doReact = (emoji: string) => { onReact?.(msg.id, emoji); setShowReact(false); setShowMenu(false) }

  const startLongPress = () => {
    if (!onReact) return
    longPress.current = setTimeout(() => setShowReact(true), 420)
  }
  const cancelLongPress = () => { if (longPress.current) { clearTimeout(longPress.current); longPress.current = null } }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMine ? 'row-reverse' : 'row',
        gap: 8, marginBottom: reactionEntries.length ? 16 : 4,
        alignItems: 'flex-end',
      }}
      onClick={() => { setShowMenu(false); setShowInfo(false); setShowReact(false) }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setShowReact(false) }}
    >
      <div
        style={{
          maxWidth: '72%', minWidth: 80,
          background: accent, color: textCol,
          borderRadius: isMine ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          padding: msg.message_type === 'text' ? '9px 14px' : '6px',
          fontSize: 14, lineHeight: 1.5,
          boxShadow: '0 1px 4px rgba(0,0,0,.18)',
          position: 'relative', cursor: 'default',
          wordBreak: 'break-word',
        }}
        onContextMenu={e => { e.preventDefault(); if (onReact) setShowReact(v => !v); else if (isMine && onDelete) setShowMenu(v => !v) }}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
      >
        {/* Quick-reaction bar */}
        {showReact && onReact && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: '100%', marginBottom: 6,
              [isMine ? 'right' : 'left']: 0,
              display: 'flex', alignItems: 'center', gap: 2, padding: 4,
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 22, boxShadow: 'var(--shadow-lg)', zIndex: 55,
              animation: 'fadeUp 130ms ease',
            }}
          >
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
            {isMine && onDelete && (
              <button
                onClick={() => { onDelete(msg.id); setShowReact(false) }}
                title="Hapus pesan"
                style={{
                  width: 34, height: 34, marginLeft: 2,
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
        {msg.message_type === 'text' && <span>{msg.content}</span>}

        {msg.message_type === 'image' && msg.file_url && (
          <img
            src={msg.file_url}
            alt={msg.file_name ?? 'image'}
            onClick={e => { e.stopPropagation(); setLightboxSrc(msg.file_url) }}
            style={{
              maxWidth: '100%', maxHeight: 240, borderRadius: 10,
              display: 'block', objectFit: 'cover', cursor: 'zoom-in',
            }}
          />
        )}

        {msg.message_type === 'video' && msg.file_url && (
          <video
            src={msg.file_url}
            controls
            style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, display: 'block' }}
          />
        )}

        {(msg.message_type === 'document' || msg.message_type === 'audio') && msg.file_url && (
          <a
            href={msg.file_url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
              color: textCol, textDecoration: 'none',
            }}
          >
            <FileIcon name={msg.file_name ?? ''} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                {msg.file_name ?? 'File'}
              </div>
              {msg.file_size && (
                <div style={{ fontSize: 11, opacity: 0.7 }}>{fmtSize(msg.file_size)}</div>
              )}
            </div>
            <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 'auto', textDecoration: 'underline' }}>Unduh</span>
          </a>
        )}

        <div
          onClick={e => { if (isMine) { e.stopPropagation(); setShowInfo(v => !v) } }}
          style={{
            fontSize: 10, opacity: 0.7, marginTop: 4,
            textAlign: isMine ? 'right' : 'left',
            display: 'flex', alignItems: 'center', justifyContent: isMine ? 'flex-end' : 'flex-start',
            gap: 4, cursor: isMine ? 'pointer' : 'default',
          }}
        >
          <span>{fmtTime(msg.created_at)}</span>
          {isMine && <Ticks delivered={!!msg.delivered_at} read={!!msg.read_at} />}
        </div>

        {showInfo && isMine && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 4,
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 10, padding: '8px 12px',
            boxShadow: 'var(--shadow-lg)', minWidth: 150,
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

        {showMenu && isMine && onDelete && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, zIndex: 50,
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 8, padding: '4px 0',
            boxShadow: 'var(--shadow-lg)', minWidth: 120,
          }}>
            <button
              onClick={() => { onDelete(msg.id); setShowMenu(false) }}
              style={{
                width: '100%', padding: '8px 14px', background: 'none',
                border: 'none', color: 'var(--red)', fontSize: 13, cursor: 'pointer',
                fontFamily: 'var(--font)', textAlign: 'left',
              }}
            >Hapus pesan</button>
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
                    background: mine ? 'var(--accent-light)' : 'var(--bg3)',
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

      {/* Hover trigger (desktop) to open the reaction bar */}
      {onReact && hover && !showReact && (
        <button
          onClick={e => { e.stopPropagation(); setShowReact(true) }}
          title="Beri reaksi"
          style={{
            width: 28, height: 28, flexShrink: 0, alignSelf: 'center',
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: '50%', cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--silver3)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>
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
