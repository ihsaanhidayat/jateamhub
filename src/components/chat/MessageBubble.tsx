import { useState } from 'react'
import type { ChatMessage } from '../../utils/supabaseClient'

interface Props {
  msg:       ChatMessage
  isMine:    boolean
  onDelete?: (id: string) => void
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

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
  const [showMenu, setShowMenu] = useState(false)
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
      onClick={() => setShowMenu(false)}
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
          <a href={msg.file_url} target="_blank" rel="noreferrer">
            <img
              src={msg.file_url}
              alt={msg.file_name ?? 'image'}
              style={{
                maxWidth: '100%', maxHeight: 240, borderRadius: 10,
                display: 'block', objectFit: 'cover',
              }}
            />
          </a>
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

        <div style={{
          fontSize: 10, opacity: 0.65, marginTop: 4,
          textAlign: isMine ? 'right' : 'left',
          display: 'flex', alignItems: 'center', justifyContent: isMine ? 'flex-end' : 'flex-start',
          gap: 4,
        }}>
          {fmtTime(msg.created_at)}
          {isMine && <span style={{ fontSize: 11 }}>{msg.is_read ? '✓✓' : '✓'}</span>}
        </div>

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
    </div>
  )
}
