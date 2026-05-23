import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../utils/supabaseClient'

interface Props { sectionId: string }

export default function NotesWidget({ sectionId }: Props) {
  const { personalSections, updateItem, addItem, syncPersonalToDb, toggleCollapse } = useStore()
  const section  = personalSections.find(s => s.id === sectionId)
  const noteItem = section?.items?.[0]

  const [text,     setText]     = useState(noteItem?.desc ?? noteItem?.title ?? '')
  const [saved,    setSaved]    = useState(true)
  const [locked,   setLocked]   = useState(false) // apakah notes terkunci
  const [showLock, setShowLock] = useState(false)  // tampilkan prompt password
  const [pwInput,  setPwInput]  = useState('')
  const [pwError,  setPwError]  = useState('')
  const [checking, setChecking] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { profile } = useAuthStore()

  useEffect(() => {
    const s    = useStore.getState().personalSections.find(s => s.id === sectionId)
    const item = s?.items?.[0]
    setText(item?.desc ?? item?.title ?? '')
  }, [sectionId])

  // Kunci otomatis saat idle 3 detik (jika pernah di-lock)
  const resetIdleTimer = () => {
    if (idleRef.current) clearTimeout(idleRef.current)
    idleRef.current = setTimeout(() => {
      const s = useStore.getState().personalSections.find(s => s.id === sectionId)
      if (s && !s.collapsed) toggleCollapse(sectionId)
    }, 3000)
  }

  const handleChange = (val: string) => {
    if (locked) return
    setText(val)
    setSaved(false)
    resetIdleTimer()
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

  // Verifikasi password ke Supabase
  const handleUnlock = async () => {
    if (!profile || !pwInput) return
    setChecking(true)
    setPwError('')
    const email = `${profile.username}@jateamhub.app`
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwInput })
    setChecking(false)
    if (error) {
      setPwError('Password salah.')
      setPwInput('')
    } else {
      setLocked(false)
      setShowLock(false)
      setPwInput('')
    }
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg2)', minHeight: 180, position: 'relative',
    }}>
      {/* Status bar */}
      <div style={{
        padding: '4px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 10, color: saved ? 'var(--silver3)' : 'var(--accent)',
        fontFamily: 'var(--mono)', letterSpacing: '.5px',
        borderBottom: '1px solid var(--border)', flexShrink: 0, transition: 'color .3s',
      }}>
        <span>{saved ? '✓ tersimpan' : '● menyimpan...'}</span>
        {/* Tombol mata — toggle lock */}
        <button
          onClick={() => {
            if (locked) {
              setShowLock(true)
            } else {
              setLocked(true)
              setShowLock(false)
            }
          }}
          title={locked ? 'Buka catatan' : 'Kunci catatan'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: locked ? 'var(--accent)' : 'var(--silver3)',
            padding: '2px 4px', lineHeight: 1,
          }}
        >{locked ? '🔒' : '👁'}</button>
      </div>

      {/* Konten terkunci */}
      {locked ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16,
        }}>
          <span style={{ fontSize: 28 }}>🔒</span>
          <span style={{ fontSize: 12, color: 'var(--silver3)', textAlign: 'center' }}>
            Catatan terkunci
          </span>
          <button
            onClick={() => setShowLock(true)}
            style={{
              height: 32, padding: '0 16px',
              background: 'var(--accent)', border: 'none',
              borderRadius: 'var(--radius-sm)', color: 'white',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)',
            }}>Buka</button>
        </div>
      ) : (
        <textarea
          value={text}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (idleRef.current) clearTimeout(idleRef.current) }}
          placeholder="Tulis catatan rahasia..."
          style={{
            flex: 1, width: '100%', background: 'transparent',
            border: 'none', outline: 'none', resize: 'none',
            color: 'var(--silver)', fontSize: 13, lineHeight: 1.6,
            fontFamily: 'var(--font)', padding: '10px 12px', minHeight: 140,
          }}
        />
      )}

      {/* Password prompt overlay */}
      {showLock && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20,
        }}>
          <span style={{ fontSize: 22 }}>🔐</span>
          <span style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>Masukkan password</span>
          <input
            type="password"
            value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError('') }}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            autoFocus
            placeholder="Password akun kamu"
            style={{
              width: '100%', height: 36, borderRadius: 6,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: 'white', fontSize: 13, padding: '0 10px',
              fontFamily: 'var(--font)', outline: 'none',
            }}
          />
          {pwError && <span style={{ fontSize: 11, color: '#FCA5A5' }}>{pwError}</span>}
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button onClick={() => { setShowLock(false); setPwInput(''); setPwError('') }} style={{
              flex: 1, height: 32, background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6,
              color: 'white', fontSize: 12, cursor: 'pointer',
            }}>Batal</button>
            <button onClick={handleUnlock} disabled={checking || !pwInput} style={{
              flex: 2, height: 32, background: 'var(--accent)', border: 'none',
              borderRadius: 6, color: 'white', fontSize: 12, fontWeight: 600,
              cursor: checking ? 'not-allowed' : 'pointer',
            }}>{checking ? '...' : 'Buka'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
