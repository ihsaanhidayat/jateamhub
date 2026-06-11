import { useState, useRef } from 'react'
import { useChatStore } from '../../store/chatStore'
import EmojiPicker from './EmojiPicker'

const ACCEPT = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar'
const MAX_MB = 50

interface Props { senderId: string }

export default function ChatInput({ senderId }: Props) {
  const { sendText, sendFile, sending, currentConvId } = useChatStore()
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [fileErr, setFileErr] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)

  const insertEmoji = (emoji: string) => {
    const el = taRef.current
    if (!el) { setText(t => t + emoji); return }
    const start = el.selectionStart ?? text.length
    const end   = el.selectionEnd   ?? text.length
    const next  = text.slice(0, start) + emoji + text.slice(end)
    setText(next)
    // Restore caret after the inserted emoji
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    })
  }

  const handleSend = async () => {
    if (!text.trim() || sending) return
    const t = text
    setText('')
    setEmojiOpen(false)
    if (taRef.current) taRef.current.style.height = '38px'
    await sendText(t, senderId)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > MAX_MB * 1024 * 1024) {
      setFileErr(`File terlalu besar. Maksimal ${MAX_MB}MB.`)
      setTimeout(() => setFileErr(''), 3000)
      return
    }
    setFileErr('')
    await sendFile(file, senderId)
  }

  if (!currentConvId) return null

  return (
    <div style={{
      padding: '10px 16px 14px',
      borderTop: '1px solid var(--border)',
      background: 'var(--bg2)',
    }}>
      {fileErr && (
        <div style={{
          padding: '6px 12px', marginBottom: 8,
          background: 'var(--red-bg)', borderRadius: 8,
          color: 'var(--red)', fontSize: 12,
        }}>{fileErr}</div>
      )}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative',
      }}>
        {emojiOpen && (
          <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />
        )}

        {/* Emoji */}
        <button
          onClick={() => setEmojiOpen(v => !v)}
          disabled={sending}
          title="Emoji"
          style={{
            width: 38, height: 38, flexShrink: 0,
            background: emojiOpen ? 'var(--accent-light)' : 'var(--bg4)',
            border: '1px solid var(--border2)',
            borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, transition: 'all 150ms',
          }}
        >
          😊
        </button>

        {/* Attachment */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={sending}
          title="Kirim file/gambar"
          style={{
            width: 38, height: 38, flexShrink: 0,
            background: 'var(--bg4)', border: '1px solid var(--border2)',
            borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--silver3)', fontSize: 17, transition: 'all 150ms',
          }}
        >
          📎
        </button>
        <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={handleFile} />

        {/* Text area — auto-grow */}
        <textarea
          ref={taRef}
          value={text}
          onChange={e => {
            setText(e.target.value)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 120) + 'px'
          }}
          onKeyDown={handleKey}
          placeholder="Ketik pesan..."
          rows={1}
          disabled={sending}
          style={{
            flex: 1, height: 38, maxHeight: 120,
            padding: '9px 12px', resize: 'none', overflow: 'hidden',
            background: 'var(--bg4)', border: '1px solid var(--border2)',
            borderRadius: 10, fontSize: 14, color: 'var(--silver)',
            fontFamily: 'var(--font)', outline: 'none', lineHeight: 1.45,
            transition: 'border-color 150ms', boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e  => e.target.style.borderColor = 'var(--border2)'}
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          style={{
            width: 38, height: 38, flexShrink: 0,
            background: text.trim() && !sending ? 'var(--accent)' : 'var(--border2)',
            border: 'none', borderRadius: 10, cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 150ms',
          }}
        >
          {sending
            ? <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
            : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          }
        </button>
      </div>
    </div>
  )
}
