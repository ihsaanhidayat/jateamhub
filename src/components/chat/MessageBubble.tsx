import { useState, useEffect } from 'react'
import type { ChatMessage } from '../../utils/supabaseClient'

interface Props {
  msg:       ChatMessage
  isMine:    boolean
  onDelete?: (id: string) => void
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

export default function MessageBubble({ msg, isMine, onDelete }: Props) {
  const [showMenu,    setShowMenu]    = useState(false)
  const [showInfo,    setShowInfo]    = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const accent  = isMine ? 'var(--accent)' : 'var(--bg4)'
  const textCol = isMine ? 'white' : 'var(--silver)'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMine ? 'row-reverse' : 'row',
        gap: 8, marginBottom: 4,
        alignItems: 'flex-end',
      }}
      onClick={() => { setShowMenu(false); setShowInfo(false) }}
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
        onContextMenu={e => { e.preventDefault(); if (isMine && onDelete) setShowMenu(v => !v) }}
      >
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
      </div>

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
