// NotesWidget — Catatan dengan pilihan lock mode
// Lock mode: 'auto' = terkunci otomatis, 'manual' = buka terus
import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../utils/supabaseClient'

interface Props { sectionId: string }

type LockMode = 'manual' | 'auto'

export default function NotesWidget({ sectionId }: Props) {
  const { personalSections, updateItem, addItem, syncPersonalToDb } = useStore()
  const section = personalSections.find(s => s.id === sectionId)
  const noteItem = section?.items?.[0]

  const [text, setText] = useState(noteItem?.desc ?? '')
  const [saved, setSaved] = useState(true)
  const [locked, setLocked] = useState(false)
  const [showLock, setShowLock] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState('')
  const [checking, setChecking] = useState(false)
  const [lockMode, setLockMode] = useState<LockMode>(() => {
    // Baca preferensi dari localStorage
    return (localStorage.getItem(`notes-lockmode-${sectionId}`) as LockMode) ?? 'manual'
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { profile } = useAuthStore()

  // Sync text dari section
  useEffect(() => {
    const s = useStore.getState().personalSections.find(s => s.id === sectionId)
    setText(s?.items?.[0]?.desc ?? '')
  }, [sectionId])

  // Auto-lock saat mode auto dan tidak ada aktivitas 60 detik
  useEffect(() => {
    if (lockMode !== 'auto' || locked) return
    const t = setTimeout(() => setLocked(true), 60 * 1000)
    return () => clearTimeout(t)
  }, [lockMode, locked, text])

  const saveLockMode = (mode: LockMode) => {
    setLockMode(mode)
    localStorage.setItem(`notes-lockmode-${sectionId}`, mode)
    if (mode === 'auto') setLocked(false) // reset lock state
  }

  const handleChange = (val: string) => {
    if (locked) return
    setText(val); setSaved(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const s = useStore.getState().personalSections.find(s => s.id === sectionId)
      if (!s) return
      if (s.items.length > 0) {
        updateItem(sectionId, s.items[0].id, {
          ...s.items[0], desc: val, title: val.split('\n')[0]?.slice(0, 50) || 'Catatan',
        })
      } else {
        addItem(sectionId, {
          title: val.split('\n')[0]?.slice(0, 50) || 'Catatan',
          url: '#', icon: '', desc: val, tags: [], newTab: false, useFavicon: false,
        } as any)
      }
      await syncPersonalToDb()
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
    else { setLocked(false); setShowLock(false); setPwInput('') }
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg2)', minHeight: 180, position: 'relative',
    }}>
      {/* Status bar */}
      <div style={{
        padding: '4px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 10, color: 'var(--silver3)', fontFamily: 'var(--mono)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ color: saved ? 'var(--silver3)' : 'var(--accent)' }}>
          {saved ? '✓ tersimpan' : '● menyimpan...'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Toggle lock mode */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg3)', borderRadius: 4, padding: 2 }}>
            {(['manual', 'auto'] as LockMode[]).map(mode => (
              <button key={mode} onClick={() => saveLockMode(mode)} style={{
                background: lockMode === mode ? 'var(--accent)' : 'none',
                border: 'none', borderRadius: 3, padding: '1px 6px',
                color: lockMode === mode ? 'white' : 'var(--silver3)',
                fontSize: 9, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--mono)', textTransform: 'uppercase',
              }}>{mode}</button>
            ))}
          </div>

          {/* Lock/unlock button */}
          <button
            onClick={() => {
              if (locked) {
                setShowLock(true) // buka — minta password
              } else {
                setLocked(true)   // kunci — selalu bisa dikunci, baik manual maupun auto
                setShowLock(false)
              }
            }}
            title={locked ? 'Buka catatan' : 'Kunci catatan'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
              color: locked ? 'var(--accent)' : 'var(--silver3)', padding: '1px 3px'
            }}>
            {locked ? '🔒' : lockMode === 'auto' ? '🔐' : '🔓'}
          </button>
        </div>
      </div>

      {/* Konten terkunci */}
      {locked ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
          <span style={{ fontSize: 28 }}>🔒</span>
          <span style={{ fontSize: 12, color: 'var(--silver3)' }}>Catatan terkunci</span>
          <button onClick={() => setShowLock(true)} style={{
            height: 32, padding: '0 16px', background: 'var(--accent)', border: 'none',
            borderRadius: 'var(--radius-sm)', color: 'white', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>Buka</button>
        </div>
      ) : (
        <textarea value={text} onChange={e => handleChange(e.target.value)}
          placeholder={lockMode === 'auto' ? '🔐 Catatan sensitif (auto-lock 1 menit)...' : '📝 Tulis catatan...'}
          style={{
            flex: 1, width: '100%', background: 'transparent', border: 'none', outline: 'none',
            resize: 'none', color: 'var(--silver)', fontSize: 13, lineHeight: 1.6,
            fontFamily: 'var(--font)', padding: '10px 12px', minHeight: 140,
          }}
        />
      )}

      {/* Password prompt */}
      {showLock && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'var(--bg3)',
          borderRadius: 'inherit',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 10, padding: 20,
        }}>
          <span style={{ fontSize: 22 }}>🔐</span>
          <span style={{ fontSize: 12, color: 'var(--silver)', fontWeight: 600 }}>Masukkan password</span>
          <input type="password" value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError('') }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            autoFocus placeholder="Password akun kamu"
            style={{ width: '100%', height: 36, borderRadius: 6, background: 'var(--bg4)', border: '1px solid var(--border2)', color: 'var(--silver)', fontSize: 13, padding: '0 10px', fontFamily: 'var(--font)', outline: 'none' }} />
          {pwError && <span style={{ fontSize: 11, color: 'var(--red)' }}>{pwError}</span>}
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button onClick={() => { setShowLock(false); setPwInput(''); setPwError('') }} style={{ flex: 1, height: 32, background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font)' }}>Batal</button>
            <button onClick={handleUnlock} disabled={checking || !pwInput} style={{ flex: 2, height: 32, background: 'var(--accent)', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>{checking ? '...' : 'Buka'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
