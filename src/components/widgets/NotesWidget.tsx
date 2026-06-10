import { useState, useEffect, useRef, memo } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { hashPin, verifyPin } from '../../utils/security'

interface Props { sectionId: string }

function NotesWidgetImpl({ sectionId }: Props) {
  const section  = useStore(s => s.personalSections.find(sec => sec.id === sectionId))
  const noteItem = section?.items?.[0]
  const setNotesLockActive = useStore(s => (s as any).setNotesLockActive)
  const { profile } = useAuthStore()

  // Stable ref avoids stale closures in event handlers and timers
  const usernameRef = useRef<string>(profile?.username ?? 'u')
  useEffect(() => { usernameRef.current = profile?.username ?? 'u' }, [profile?.username])

  // All key derivation through functions that read the ref fresh
  const getModeKey    = () => `notes-mode-${usernameRef.current}-${sectionId}`
  const getLockedKey  = () => `notes-locked-${usernameRef.current}-${sectionId}`
  const getPinHashKey = () => `notes-pin-hash-${usernameRef.current}-${sectionId}`
  const getPinSaltKey = () => `notes-pin-salt-${usernameRef.current}-${sectionId}`
  const getSessionKey = () => `notes-session-${usernameRef.current}-${sectionId}`
  const readMode      = () => (localStorage.getItem(getModeKey()) as 'lock'|'open') ?? 'open'
  const readLocked    = () => localStorage.getItem(getLockedKey()) === 'true'
  const hasPinStored  = () => !!localStorage.getItem(getPinHashKey())

  const [mode,   setMode]       = useState<'lock'|'open'>(() => readMode())
  const [locked, setLockedState] = useState<boolean>(() => {
    if (readMode() !== 'lock') return readLocked()
    return sessionStorage.getItem(getSessionKey()) !== '1'
  })
  const [text,   setText]     = useState(noteItem?.desc ?? '')
  const [saved,  setSaved]    = useState(true)
  const [showPw, setShowPw]   = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState('')
  const [checking, setChecking] = useState(false)

  // PIN setup state (first-time activation)
  const [showSetPin,  setShowSetPin]  = useState(false)
  const [newPin,      setNewPin]      = useState('')
  const [confirmPin,  setConfirmPin]  = useState('')
  const [pinSetError, setPinSetError] = useState('')
  const [settingPin,  setSettingPin]  = useState(false)
  const confirmPinRef = useRef<HTMLInputElement>(null)

  // Rate limiting
  const failedAttemptsRef = useRef(0)
  const [lockoutUntil,     setLockoutUntil]     = useState(0)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)

  const textareaRef     = useRef<HTMLTextAreaElement>(null)
  const timerRef        = useRef<ReturnType<typeof setTimeout>|null>(null)
  const lockTimer       = useRef<ReturnType<typeof setTimeout>|null>(null)
  const modeEffectFirst = useRef(true)

  const autoGrow = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }
  useEffect(() => { autoGrow() }, [text, locked])

  // setLocked: updates state + localStorage + session + notifies SectionCard header
  const setLocked = (val: boolean) => {
    setLockedState(val)
    localStorage.setItem(getLockedKey(), String(val))
    if (val) sessionStorage.removeItem(getSessionKey())
    else sessionStorage.setItem(getSessionKey(), '1')
    window.dispatchEvent(new CustomEvent('notes-mode-changed', { detail: { sectionId } }))
  }

  // Sync state once profile is resolved (fixes null-username race on mount)
  useEffect(() => {
    if (!profile?.username) return
    const m = readMode()
    const l = m === 'lock'
      ? sessionStorage.getItem(getSessionKey()) !== '1'
      : readLocked()
    setMode(m)
    setLockedState(l)
  }, [profile?.username, sectionId])

  // Sync textarea text when section data changes
  useEffect(() => {
    const s = useStore.getState().personalSections.find(s => s.id === sectionId)
    setText(s?.items?.[0]?.desc ?? '')
  }, [sectionId])

  // Listen for mode/lock changes dispatched by SectionCard header
  useEffect(() => {
    const handler = (e: Event) => {
      const sid = (e as CustomEvent).detail?.sectionId
      if (sid && sid !== sectionId) return
      const newMode = readMode()
      // First-time lock activation: redirect to PIN setup
      if (newMode === 'lock' && !hasPinStored()) {
        localStorage.setItem(getModeKey(), 'open')
        localStorage.setItem(getLockedKey(), 'false')
        setMode('open')
        setLockedState(false)
        setShowSetPin(true)
        window.dispatchEvent(new CustomEvent('notes-mode-changed', { detail: { sectionId } }))
        return
      }
      setMode(newMode)
      setLockedState(readLocked())
      startIdleTimer(newMode)
    }
    window.addEventListener('notes-mode-changed', handler)
    return () => window.removeEventListener('notes-mode-changed', handler)
  }, [sectionId])

  // Auto-lock when mode transitions to 'lock' (skip on initial mount)
  useEffect(() => {
    const isFirst = modeEffectFirst.current
    modeEffectFirst.current = false
    if (!isFirst && mode === 'lock') setLocked(true)
    startIdleTimer(mode)
    return () => { if (lockTimer.current) clearTimeout(lockTimer.current) }
  }, [mode])

  // Lock when tab goes background (only in lock mode)
  useEffect(() => {
    if (mode !== 'lock') return
    const h = () => { if (document.visibilityState === 'hidden') setLocked(true) }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [mode])

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutUntil <= Date.now()) return
    const update = () => {
      const rem = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000))
      setLockoutRemaining(rem)
      if (rem === 0) { setLockoutUntil(0); setLockoutRemaining(0) }
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [lockoutUntil])

  // Hide search bar when a PIN dialog is open
  useEffect(() => {
    setNotesLockActive?.(showPw || showSetPin)
    return () => setNotesLockActive?.(false)
  }, [showPw, showSetPin])

  const startIdleTimer = (currentMode?: string) => {
    if (lockTimer.current) clearTimeout(lockTimer.current)
    if ((currentMode ?? mode) === 'lock') {
      lockTimer.current = setTimeout(() => setLocked(true), 30 * 60_000)
    }
  }
  const resetIdleTimer = () => startIdleTimer()

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

  // Set PIN for the first time (or reset)
  const handleSetPin = async () => {
    const pin = newPin.trim()
    if (pin.length < 4) { setPinSetError('PIN minimal 4 karakter'); return }
    if (pin !== confirmPin.trim()) { setPinSetError('PIN tidak cocok'); return }
    setSettingPin(true); setPinSetError('')
    try {
      const salt = crypto.randomUUID()
      const hash = await hashPin(pin, salt)
      localStorage.setItem(getPinHashKey(), hash)
      localStorage.setItem(getPinSaltKey(), salt)
      localStorage.setItem(getModeKey(), 'lock')
      localStorage.setItem(getLockedKey(), 'true')
      sessionStorage.removeItem(getSessionKey())
      setMode('lock')
      setLockedState(true)
      setShowSetPin(false)
      setNewPin(''); setConfirmPin('')
      window.dispatchEvent(new CustomEvent('notes-mode-changed', { detail: { sectionId } }))
    } catch {
      setPinSetError('Gagal mengatur PIN. Coba lagi.')
    } finally {
      setSettingPin(false)
    }
  }

  // Unlock with PBKDF2 verification + rate limiting
  const handleUnlock = async () => {
    if (lockoutRemaining > 0) return
    const pin = pwInput.trim()
    if (!pin) return
    const storedHash = localStorage.getItem(getPinHashKey())
    const storedSalt = localStorage.getItem(getPinSaltKey())
    // No PIN stored: show setup dialog (handles migration from old auth system)
    if (!storedHash || !storedSalt) {
      setShowPw(false); setPwInput(''); setPwError('')
      setShowSetPin(true)
      return
    }
    setChecking(true); setPwError('')
    const ok = await verifyPin(pin, storedSalt, storedHash)
    setChecking(false)
    if (ok) {
      failedAttemptsRef.current = 0
      setLocked(false); setShowPw(false); setPwInput(''); resetIdleTimer()
    } else {
      failedAttemptsRef.current += 1
      const n = failedAttemptsRef.current
      setPwInput('')
      if (n >= 6) {
        setLockoutUntil(Date.now() + 5 * 60_000)
        setPwError('Terlalu banyak percobaan. Tunggu 5 menit.')
      } else if (n >= 3) {
        setLockoutUntil(Date.now() + 30_000)
        setPwError('Terlalu banyak percobaan. Tunggu 30 detik.')
      } else {
        setPwError(`PIN salah. ${3 - n} percobaan sebelum kunci sementara.`)
      }
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 36, borderRadius: 7,
    background: 'var(--bg4)', border: '1px solid var(--border2)',
    color: 'var(--silver)', fontSize: 13, padding: '0 10px',
    fontFamily: 'var(--font)', outline: 'none',
  }
  const overlayStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, zIndex: 10, background: 'var(--bg3)',
    borderRadius: 'inherit', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20,
  }
  const btnSecondary: React.CSSProperties = {
    flex: 1, height: 32, background: 'var(--bg4)',
    border: '1px solid var(--border2)', borderRadius: 7,
    color: 'var(--silver3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)',
  }
  const btnPrimary = (disabled: boolean): React.CSSProperties => ({
    flex: 2, height: 32, background: 'var(--accent)', border: 'none',
    borderRadius: 7, color: 'white', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
    fontFamily: 'var(--font)',
  })

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg2)', position: 'relative' }}>
      {/* Status bar */}
      <div style={{
        padding: '3px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 9, fontFamily: 'var(--mono)', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        {mode === 'lock' && !locked && (
          <button onClick={() => {
            localStorage.setItem(getModeKey(), 'open')
            localStorage.setItem(getLockedKey(), 'false')
            setMode('open'); setLockedState(false)
            window.dispatchEvent(new CustomEvent('notes-mode-changed', { detail: { sectionId } }))
          }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>
            🔓 buka permanen
          </button>
        )}
        <span style={{ color: saved ? 'var(--silver4)' : 'var(--accent)', marginLeft: 'auto' }}>
          {saved ? '✓ tersimpan' : '● menyimpan...'}
        </span>
      </div>

      {/* Locked placeholder */}
      {locked ? (
        <div style={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
          <span style={{ fontSize: 28 }}>🔒</span>
          <span style={{ fontSize: 12, color: 'var(--silver3)' }}>Catatan terkunci</span>
          <button
            onClick={() => hasPinStored() ? setShowPw(true) : setShowSetPin(true)}
            style={{ height: 32, padding: '0 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >Buka</button>
        </div>
      ) : (
        <textarea
          ref={textareaRef} value={text}
          onChange={e => { handleChange(e.target.value); autoGrow() }}
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

      {/* PIN unlock overlay */}
      {showPw && (
        <div style={overlayStyle}>
          <span style={{ fontSize: 22 }}>🔐</span>
          <span style={{ fontSize: 12, color: 'var(--silver)', fontWeight: 600 }}>Masukkan PIN</span>
          {lockoutRemaining > 0 ? (
            <span style={{ fontSize: 11, color: 'var(--red)', textAlign: 'center' }}>
              Terlalu banyak percobaan.<br />Coba lagi dalam {lockoutRemaining}s
            </span>
          ) : (
            <>
              <input
                type="password" value={pwInput}
                onChange={e => { setPwInput(e.target.value); setPwError('') }}
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                autoFocus placeholder="PIN catatan"
                style={{ ...inputStyle, borderColor: pwError ? 'var(--red)' : 'var(--border2)' }}
              />
              {pwError && <span style={{ fontSize: 11, color: 'var(--red)' }}>{pwError}</span>}
            </>
          )}
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button onClick={() => { setShowPw(false); setPwInput(''); setPwError('') }} style={btnSecondary}>Batal</button>
            <button
              onClick={handleUnlock}
              disabled={checking || !pwInput.trim() || lockoutRemaining > 0}
              style={btnPrimary(checking || !pwInput.trim() || lockoutRemaining > 0)}
            >{checking ? 'Memverifikasi...' : 'Buka'}</button>
          </div>
        </div>
      )}

      {/* PIN setup overlay (first-time or migration) */}
      {showSetPin && (
        <div style={overlayStyle}>
          <span style={{ fontSize: 22 }}>🔐</span>
          <span style={{ fontSize: 12, color: 'var(--silver)', fontWeight: 600 }}>Buat PIN catatan</span>
          <span style={{ fontSize: 10, color: 'var(--silver3)', textAlign: 'center', lineHeight: 1.5 }}>
            Minimal 4 karakter. Berbeda dari password akun.
          </span>
          <input
            type="password" value={newPin}
            onChange={e => { setNewPin(e.target.value); setPinSetError('') }}
            onKeyDown={e => e.key === 'Enter' && confirmPinRef.current?.focus()}
            autoFocus placeholder="PIN baru"
            style={{ ...inputStyle, borderColor: pinSetError ? 'var(--red)' : 'var(--border2)' }}
          />
          <input
            ref={confirmPinRef} type="password" value={confirmPin}
            onChange={e => { setConfirmPin(e.target.value); setPinSetError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSetPin()}
            placeholder="Konfirmasi PIN"
            style={{ ...inputStyle, borderColor: pinSetError ? 'var(--red)' : 'var(--border2)' }}
          />
          {pinSetError && <span style={{ fontSize: 11, color: 'var(--red)' }}>{pinSetError}</span>}
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button onClick={() => { setShowSetPin(false); setNewPin(''); setConfirmPin(''); setPinSetError('') }} style={btnSecondary}>Batal</button>
            <button
              onClick={handleSetPin}
              disabled={settingPin || newPin.length < 4}
              style={btnPrimary(settingPin || newPin.length < 4)}
            >{settingPin ? 'Menyimpan...' : 'Simpan PIN'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(NotesWidgetImpl)
