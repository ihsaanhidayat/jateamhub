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
  const editing       = useChatStore(s => s.editing)
  const setEditing    = useChatStore(s => s.setEditing)
  const editText      = useChatStore(s => s.editText)

  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [fileErr, setFileErr] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingUrl, setPendingUrl]   = useState<string | null>(null)
  const [caption, setCaption]         = useState('')
  const mrRef     = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelRef = useRef(false)

  const resetHeight = () => { if (taRef.current) taRef.current.style.height = '24px' }

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setFileErr('Perekaman suara tidak didukung di perangkat ini.'); setTimeout(() => setFileErr(''), 3000); return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      cancelRef.current = false
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        setRecording(false); setRecordSecs(0)
        if (cancelRef.current) return
        const type = mr.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        if (blob.size < 800) return   // too short — ignore
        const ext = type.includes('mp4') ? 'm4a' : 'webm'
        await sendFile(new File([blob], `Pesan suara ${Date.now()}.${ext}`, { type }), senderId)
      }
      mr.start()
      mrRef.current = mr
      setRecording(true); setRecordSecs(0)
      timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
    } catch {
      setFileErr('Tidak dapat mengakses mikrofon.'); setTimeout(() => setFileErr(''), 3000)
    }
  }

  const stopRecording = (cancel: boolean) => {
    cancelRef.current = cancel
    try { mrRef.current?.stop() } catch { /* ignore */ }
  }

  // Cleanup on unmount.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  // Focus the composer when starting a reply.
  useEffect(() => { if (replyTo) taRef.current?.focus() }, [replyTo])

  // Load the message text into the composer when starting an edit.
  useEffect(() => {
    if (editing) {
      setText(editing.content ?? '')
      requestAnimationFrame(() => {
        const el = taRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, 120) + 'px'
      })
    }
  }, [editing])

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

  const cancelEdit = () => { setEditing(null); setText(''); resetHeight() }

  const handleSend = async () => {
    if (!text.trim() || sending) return
    const t = text
    setText('')
    setEmojiOpen(false)
    resetHeight()
    taRef.current?.focus()   // keep the keyboard open on mobile
    if (editing) await editText(editing.id, t, senderId)
    else await sendText(t, senderId)
    taRef.current?.focus()
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
    // Images/videos → preview with optional caption; others send immediately.
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setPendingFile(file)
      setPendingUrl(URL.createObjectURL(file))
      setCaption('')
    } else {
      await sendFile(file, senderId)
    }
  }

  const closePending = () => {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl)
    setPendingFile(null); setPendingUrl(null); setCaption('')
  }

  const sendPending = async () => {
    if (!pendingFile || sending) return
    const f = pendingFile, cap = caption
    closePending()
    await sendFile(f, senderId, cap)
  }

  if (!currentConvId) return null

  const canSend = !!text.trim() && !sending
  const showMic = !text.trim() && !editing
  const iconBtn = (active: boolean): React.CSSProperties => ({
    width: 34, height: 34, flexShrink: 0,
    background: active ? 'var(--accent-light)' : 'none', border: 'none',
    borderRadius: '50%', cursor: 'pointer', fontSize: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--silver3)', transition: 'background 150ms',
  })

  return (
    <div style={{ flexShrink: 0, padding: '10px 14px max(14px, env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
      {pendingFile && pendingUrl && (
        <div
          onClick={e => { if (e.target === e.currentTarget) closePending() }}
          style={{ position: 'fixed', inset: 0, zIndex: 230, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', padding: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{otherName ? `Kirim ke ${otherName}` : 'Kirim media'}</span>
            <button onClick={closePending} style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', cursor: 'pointer', color: 'white', fontSize: 22, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, padding: '12px 0' }}>
            {pendingFile.type.startsWith('image/')
              ? <img src={pendingUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12 }} />
              : <video src={pendingUrl} controls style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} />}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendPending() } }}
              placeholder="Tambah keterangan…"
              autoFocus
              style={{ flex: 1, height: 46, padding: '0 16px', boxSizing: 'border-box', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 23, color: 'var(--silver)', fontSize: 14, fontFamily: 'var(--font)', outline: 'none' }}
            />
            <button onClick={sendPending} disabled={sending} title="Kirim" style={{ width: 46, height: 46, flexShrink: 0, background: 'var(--accent)', border: 'none', borderRadius: '50%', cursor: sending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {sending
                ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
            </button>
          </div>
        </div>
      )}
      {editing && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
          padding: '7px 8px 7px 11px', background: 'var(--bg4)', borderRadius: 10,
          borderLeft: '3px solid var(--accent)', animation: 'popIn 130ms ease',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)' }}>Mengedit pesan</div>
            <div style={{ fontSize: 12, color: 'var(--silver3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {editing.content}
            </div>
          </div>
          <button onClick={cancelEdit} title="Batal edit" style={{ width: 28, height: 28, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', borderRadius: '50%', color: 'var(--silver3)', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
      )}
      {replyTo && !editing && (
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
        {recording ? (
          <>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 10, height: 44,
              padding: '0 8px 0 12px', background: 'var(--bg4)', border: '1px solid var(--border2)',
              borderRadius: 22, boxSizing: 'border-box',
            }}>
              <button onClick={() => stopRecording(true)} title="Batalkan" style={{ width: 32, height: 32, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1.2s infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: 'var(--silver)', fontFamily: 'var(--mono)' }}>
                {`${Math.floor(recordSecs / 60)}:${(recordSecs % 60).toString().padStart(2, '0')}`}
              </span>
              <span style={{ flex: 1, textAlign: 'right', fontSize: 11.5, color: 'var(--silver4)' }}>Merekam…</span>
            </div>
            <button onClick={() => stopRecording(false)} title="Kirim" style={{ width: 44, height: 44, flexShrink: 0, background: 'var(--accent)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </>
        ) : (
          <>
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

            {/* Mic (empty) or Send */}
            {showMic ? (
              <button onClick={startRecording} disabled={sending} title="Rekam pesan suara" style={{
                width: 44, height: 44, flexShrink: 0, background: 'var(--accent)', border: 'none',
                borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                onMouseDown={e => e.preventDefault()}
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
            )}
          </>
        )}
      </div>
    </div>
  )
}
