import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../../store/chatStore'
import { messagePreview } from '../../utils/chatText'
import EmojiPicker from './EmojiPicker'

const ACCEPT = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar'
const MAX_MB = 50

interface Props { senderId: string; otherName?: string }

export default function ChatInput({ senderId, otherName }: Props) {
  const sendText      = useChatStore(s => s.sendText)
  const sendFile      = useChatStore(s => s.sendFile)
  const sending       = useChatStore(s => s.sending)
  const currentConvId = useChatStore(s => s.currentConvId)
  const notifyTyping  = useChatStore(s => s.notifyTyping)
  const replyTo       = useChatStore(s => s.replyTo)
  const setReplyTo    = useChatStore(s => s.setReplyTo)

  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [fileErr, setFileErr] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)

  const resetHeight = () => { if (taRef.current) taRef.current.style.height = '24px' }

  // Focus the composer when starting a reply.
  useEffect(() => { if (replyTo) taRef.current?.focus() }, [replyTo])

  const insertEmoji = (emoji: string) => {
    const el = taRef.current
    if (!el) { setText(t => t + emoji); return }
    const start = el.selectionStart ?? text.length
    const end   = el.selectionEnd   ?? text.length
    const next  = text.slice(0, start) + emoji + text.slice(end)
    setText(next)
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
    resetHeight()
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

  const canSend = !!text.trim() && !sending
  const iconBtn = (active: boolean): React.CSSProperties => ({
    width: 34, height: 34, flexShrink: 0,
    background: active ? 'var(--accent-light)' : 'none', border: 'none',
    borderRadius: '50%', cursor: 'pointer', fontSize: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--silver3)', transition: 'background 150ms',
  })

  return (
    <div style={{ flexShrink: 0, padding: '10px 14px max(14px, env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
      {replyTo && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
          padding: '7px 8px 7px 11px', background: 'var(--bg4)', borderRadius: 10,
          borderLeft: '3px solid var(--accent)', animation: 'popIn 130ms ease',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)' }}>
              Membalas {replyTo.sender_id === senderId ? 'diri sendiri' : (otherName ?? 'pesan')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--silver3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {messagePreview(replyTo)}
            </div>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            title="Batal balas"
            style={{
              width: 28, height: 28, flexShrink: 0, background: 'none', border: 'none',
              cursor: 'pointer', borderRadius: '50%', color: 'var(--silver3)', fontSize: 18, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>
      )}
      {fileErr && (
        <div style={{
          padding: '6px 12px', marginBottom: 8,
          background: 'var(--red-bg)', borderRadius: 8,
          color: 'var(--red)', fontSize: 12,
        }}>{fileErr}</div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative' }}>
        {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />}

        {/* Composer pill: emoji + attachment + textarea */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4,
          background: 'var(--bg4)', border: '1px solid var(--border2)',
          borderRadius: 22, padding: '3px 6px 3px 5px', minHeight: 44, boxSizing: 'border-box',
        }}>
          <button onClick={() => setEmojiOpen(v => !v)} disabled={sending} title="Emoji" style={iconBtn(emojiOpen)}>😊</button>
          <button onClick={() => fileRef.current?.click()} disabled={sending} title="Lampirkan file" style={iconBtn(false)}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <input ref={fileRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={handleFile} />

          <textarea
            ref={taRef}
            value={text}
            onChange={e => {
              setText(e.target.value)
              if (e.target.value.trim()) notifyTyping()
              const el = e.target
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKey}
            placeholder="Ketik pesan..."
            rows={1}
            disabled={sending}
            style={{
              flex: 1, height: 24, maxHeight: 120, padding: '7px 6px',
              resize: 'none', overflow: 'auto', background: 'none', border: 'none',
              fontSize: 14, color: 'var(--silver)', fontFamily: 'var(--font)',
              outline: 'none', lineHeight: 1.4, boxSizing: 'content-box',
            }}
          />
        </div>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            width: 44, height: 44, flexShrink: 0,
            background: canSend ? 'var(--accent)' : 'var(--bg4)',
            border: canSend ? 'none' : '1px solid var(--border2)',
            borderRadius: '50%', cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 150ms, transform 100ms',
          }}
        >
          {sending
            ? <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={canSend ? 'white' : 'var(--silver4)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          }
        </button>
      </div>
    </div>
  )
}
