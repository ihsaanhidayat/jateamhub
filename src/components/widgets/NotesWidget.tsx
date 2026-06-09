import { useState, useEffect, useRef, memo } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../utils/supabaseClient'

interface Props { sectionId: string }

function NotesWidgetImpl({ sectionId }: Props) {
  // Granular selector — hanya re-render saat section ini berubah
  const section   = useStore(s => s.personalSections.find(sec => sec.id === sectionId))
  const noteItem  = section?.items?.[0]
  const setNotesLockActive = useStore(s => (s as any).setNotesLockActive)
  const { profile } = useAuthStore()

  const modeKey   = `notes-mode-${profile?.username ?? 'u'}-${sectionId}`
  const lockedKey = `notes-locked-${profile?.username ?? 'u'}-${sectionId}`

  // Reactive read dari localStorage — listen event 'notes-mode-changed'
  const readMode   = () => (localStorage.getItem(modeKey) as 'lock'|'open') ?? 'open'
  const readLocked = () => localStorage.getItem(lockedKey) === 'true'

  const [mode,   setMode]         = useState<'lock'|'open'>(readMode)
  // Always start locked when mode is 'lock' — prevents showing unlocked state on login
  const [locked, setLockedState]  = useState<boolean>(() => readMode() === 'lock' ? true : readLocked())

  // Re-read saat profile load; mode 'lock' selalu mulai terkunci di setiap sesi baru
  useEffect(() => {
    if (!profile?.username) return
    const m = (localStorage.getItem(`notes-mode-${profile.username}-${sectionId}`) as 'lock'|'open') ?? 'open'
    const l = m === 'lock' ? true : localStorage.getItem(`notes-locked-${profile.username}-${sectionId}`) === 'true'
    setMode(m)
    setLockedState(l)
  }, [profile?.username, sectionId])
  const [text,   setText]         = useState(noteItem?.desc ?? '')
  const [saved,  setSaved]        = useState(true)
  const [showPw, setShowPw]       = useState(false)
  const [pwInput, setPwInput]     = useState('')
  const [pwError, setPwError]     = useState('')
  const [checking, setChecking]   = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow textarea
  const autoGrow = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }
  useEffect(() => { autoGrow() }, [text, locked])

  const timerRef   = useRef<ReturnType<typeof setTimeout>|null>(null)
  const lockTimer  = useRef<ReturnType<typeof setTimeout>|null>(null)

  const setLocked = (val: boolean) => {
    setLockedState(val)
    localStorage.setItem(lockedKey, String(val))
  }

  // Listen for mode changes from SectionCard header toggle
  useEffect(() => {
    const handler = () => {
      const newMode = readMode()
      const newLocked = readLocked()
      setMode(newMode)
      setLockedState(newLocked)
      // Reset idle timer setelah toggle
      startIdleTimer(newMode)
    }
    window.addEventListener('notes-mode-changed', handler)
    return () => window.removeEventListener('notes-mode-changed', handler)
  }, [])

  // Sync text
  useEffect(() => {
    const s = useStore.getState().personalSections.find(s => s.id === sectionId)
    setText(s?.items?.[0]?.desc ?? '')
  }, [sectionId])

  // Saat login — jika mode lock, pastikan terkunci
  useEffect(() => {
    if (mode === 'lock') setLocked(true)
    // Start idle timer di kedua mode
    startIdleTimer(mode)
    return () => { if (lockTimer.current) clearTimeout(lockTimer.current) }
  }, [mode])

  // Idle timer — 30 menit tanpa aktivitas → auto-lock (hanya mode 'lock')
  const startIdleTimer = (currentMode?: string) => {
    if (lockTimer.current) clearTimeout(lockTimer.current)
    const m = currentMode ?? mode
    if (m === 'lock') {
      lockTimer.current = setTimeout(() => setLocked(true), 30 * 60 * 1000)
    }
  }

  // Reset timer setiap ada aktivitas
  const resetIdleTimer = () => startIdleTimer()

  // Lock saat app background (mode lock)
  useEffect(() => {
    if (mode !== 'lock') return
    const h = () => { if (document.visibilityState === 'hidden') setLocked(true) }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [mode])

  // Hide search saat password input
  useEffect(() => {
    setNotesLockActive?.(showPw)
    return () => setNotesLockActive?.(false)
  }, [showPw])

  const handleChange = (val: string) => {
    if (locked) return
    setText(val); setSaved(false)
    resetIdleTimer()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const store = useStore.getState()
      const s = store.personalSections.find(s => s.id === sectionId)
      if (!s) return
      if (s.items.length > 0) {
        store.updateItem(sectionId, s.items[0].id, { ...s.items[0], desc: val, title: val.split('\n')[0]?.slice(0, 50) || 'Catatan' })
      } else {
        store.addItem(sectionId, { title: val.split('\n')[0]?.slice(0, 50) || 'Catatan', url: '#', icon: '', desc: val, tags: [], newTab: false, useFavicon: false } as any)
      }
      store.syncPersonalToDb()
      setSaved(true)
    }, 600)
  }

  const handleUnlock = async () => {
    if (!profile || !pwInput) return
    setChecking(true); setPwError('')
    const email = `${profile.username}@jateamhub.app`
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwInput })
    setChecking(false)
    if (error) { setPwError('Password salah.'); setPwInput('') }
    else { setLocked(false); setShowPw(false); setPwInput(''); resetIdleTimer() }
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg2)', position: 'relative' }}>
      {/* Status simpan + opsi buka permanen */}
      <div style={{
        padding: '3px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 9, fontFamily: 'var(--mono)', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        {mode === 'lock' && !locked && (
          <button onClick={() => {
            localStorage.setItem(modeKey, 'open')
            localStorage.setItem(lockedKey, 'false')
            window.dispatchEvent(new Event('notes-mode-changed'))
          }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 9, color: 'var(--silver4)', fontFamily: 'var(--mono)',
          }}>🔓 buka permanen</button>
        )}
        <span style={{ color: saved ? 'var(--silver4)' : 'var(--accent)', marginLeft: 'auto' }}>
          {saved ? '✓ tersimpan' : '● menyimpan...'}
        </span>
      </div>

      {/* Konten terkunci */}
      {locked ? (
        <div style={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
          <span style={{ fontSize: 28 }}>🔒</span>
          <span style={{ fontSize: 12, color: 'var(--silver3)' }}>Catatan terkunci</span>
          <button onClick={() => setShowPw(true)} style={{
            height: 32, padding: '0 16px', background: 'var(--accent)', border: 'none',
            borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Buka</button>
        </div>
      ) : (
        <textarea ref={textareaRef} value={text} onChange={e => { handleChange(e.target.value); autoGrow() }}
          placeholder="📝 Tulis catatan..."
          spellCheck={false}
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            resize: 'none', color: 'var(--silver)', fontSize: 13, lineHeight: '28px',
            fontFamily: 'var(--font)', padding: '8px 12px',
            minHeight: 120, overflow: 'hidden',
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, color-mix(in srgb, var(--border) 35%, transparent) 27px, color-mix(in srgb, var(--border) 35%, transparent) 28px)',
            backgroundAttachment: 'local',
          }}
        />
      )}

      {/* Password prompt */}
      {showPw && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10, background: 'var(--bg3)', borderRadius: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20,
        }}>
          <span style={{ fontSize: 22 }}>🔐</span>
          <span style={{ fontSize: 12, color: 'var(--silver)', fontWeight: 600 }}>Masukkan password</span>
          <input type="password" value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError('') }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            autoFocus placeholder="Password akun"
            style={{ width: '100%', height: 36, borderRadius: 7, background: 'var(--bg4)', border: '1px solid var(--border2)', color: 'var(--silver)', fontSize: 13, padding: '0 10px', fontFamily: 'var(--font)', outline: 'none' }} />
          {pwError && <span style={{ fontSize: 11, color: 'var(--red)' }}>{pwError}</span>}
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button onClick={() => { setShowPw(false); setPwInput(''); setPwError('') }} style={{ flex: 1, height: 32, background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--silver3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>Batal</button>
            <button onClick={handleUnlock} disabled={checking || !pwInput} style={{ flex: 2, height: 32, background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{checking ? '...' : 'Buka'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(NotesWidgetImpl)
