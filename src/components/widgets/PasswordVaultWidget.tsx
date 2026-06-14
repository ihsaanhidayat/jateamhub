import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../utils/supabaseClient'
import { useT } from '../../utils/i18n'
import {
  IconEye, IconEyeOff, IconLock, IconCopy, IconCheck,
  IconEdit, IconTrash, IconGlobe, IconRefresh, IconSearch, IconPlus, IconKey,
} from '../ui/icons'
import {
  vaultExists, createVault, changePin, unlockVault, encryptVault, decryptVault,
  isVaultUnlocked, clearVaultSession,
} from '../../utils/vaultCrypto'
import type { VaultEntry } from '../../types'

const fmtModified = (ms?: number) =>
  ms ? new Date(ms).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : ''

const IDLE_MS = 3 * 60_000   // shorter idle auto-lock for the vault

// ── Password generator ────────────────────────────────────────
const SETS = { lower: 'abcdefghijkmnopqrstuvwxyz', upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', digit: '23456789', symbol: '!@#$%^&*-_=+?' }
function genPassword(len: number, opts: { upper: boolean; digit: boolean; symbol: boolean }) {
  let pool = SETS.lower
  if (opts.upper)  pool += SETS.upper
  if (opts.digit)  pool += SETS.digit
  if (opts.symbol) pool += SETS.symbol
  const arr = crypto.getRandomValues(new Uint32Array(len))
  let out = ''
  for (let i = 0; i < len; i++) out += pool[arr[i] % pool.length]
  return out
}
function strength(pw: string): { label: string; color: string; pct: number } {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 14) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  const map = [
    { label: 'Sangat lemah', color: 'var(--red)', pct: 20 },
    { label: 'Lemah',        color: '#F59E0B',    pct: 40 },
    { label: 'Cukup',        color: '#F59E0B',    pct: 60 },
    { label: 'Kuat',         color: '#16A34A',    pct: 80 },
    { label: 'Sangat kuat',  color: '#16A34A',    pct: 100 },
  ]
  return map[Math.min(s, 4)]
}

function PasswordVaultWidgetImpl({ sectionId }: { sectionId: string }) {
  const t = useT()
  const { profile } = useAuthStore()
  const setNotesLockActive = useStore(s => (s as any).setNotesLockActive)

  const [hasVault, setHasVault] = useState<boolean | null>(null)
  const [locked,   setLocked]   = useState(true)
  const [entries,  setEntries]  = useState<VaultEntry[]>([])
  const [pin,      setPin]      = useState('')
  const [pin2,     setPin2]     = useState('')
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState('')
  const [showPin,  setShowPin]  = useState(false)

  // rate limiting
  const failsRef = useRef(0)
  const [lockoutUntil, setLockoutUntil] = useState(0)
  const [lockoutRem,   setLockoutRem]   = useState(0)

  // entry UI
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [editId,   setEditId]   = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [query,    setQuery]    = useState('')

  // add form
  const [form, setForm] = useState({ label: '', username: '', password: '', url: '' })
  const [showPw, setShowPw] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [blurred, setBlurred] = useState(false)   // privacy screen when window unfocused
  const [showGen, setShowGen] = useState(false)
  const [genLen,  setGenLen]  = useState(16)
  const [genOpts, setGenOpts] = useState({ upper: true, digit: true, symbol: true })

  // change-PIN (re-key — keeps all passwords)
  const [cpOpen, setCpOpen] = useState(false)
  const [cp1, setCp1] = useState('')
  const [cp2, setCp2] = useState('')
  const [cpErr, setCpErr] = useState('')
  const [cpBusy, setCpBusy] = useState(false)

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doLock = useCallback(() => {
    clearVaultSession()
    setLocked(true); setEntries([]); setRevealed(new Set())
    setEditId(null); setShowGen(false); setShowAdd(false)
    setForm({ label: '', username: '', password: '', url: '' })
    setCpOpen(false); setCp1(''); setCp2(''); setCpErr('')
  }, [])

  // First-run check
  useEffect(() => {
    let alive = true
    vaultExists().then(v => { if (alive) setHasVault(v) }).catch(() => { if (alive) setHasVault(false) })
    return () => { alive = false }
  }, [])

  // Idle auto-lock
  const resetIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (!isVaultUnlocked()) return
    idleTimer.current = setTimeout(doLock, IDLE_MS)
  }, [doLock])

  // Layered security: full lock when the tab is hidden / on logout; a privacy
  // screen (blur) when the window merely loses focus; idle auto-lock.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'hidden' && isVaultUnlocked()) doLock() }
    const onLogout = () => doLock()
    const onBlur = () => setBlurred(true)
    const onFocus = () => setBlurred(false)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('jateamhub-logout', onLogout)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('jateamhub-logout', onLogout)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      if (idleTimer.current) clearTimeout(idleTimer.current)
      if (clipTimer.current) clearTimeout(clipTimer.current)
      clearVaultSession()
    }
  }, [doLock])

  // Hide dashboard search while a PIN screen is up
  useEffect(() => {
    const showingGate = locked
    setNotesLockActive?.(showingGate)
    return () => setNotesLockActive?.(false)
  }, [locked])

  // Lockout countdown
  useEffect(() => {
    if (lockoutUntil <= Date.now()) return
    const upd = () => {
      const rem = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000))
      setLockoutRem(rem)
      if (rem === 0) { setLockoutUntil(0); setLockoutRem(0) }
    }
    upd()
    const iv = setInterval(upd, 1000)
    return () => clearInterval(iv)
  }, [lockoutUntil])

  // ── Persist (re-encrypt full list) ──────────────────────────
  const persist = useCallback(async (next: VaultEntry[]) => {
    setEntries(next)
    try {
      const blob = await encryptVault(next)
      const store = useStore.getState()
      const s = store.personalSections.find(x => x.id === sectionId)
      if (!s) return
      if (s.items.length > 0) {
        store.updateItem(sectionId, s.items[0].id, { ...s.items[0], desc: blob, title: 'vault-data' })
      } else {
        store.addItem(sectionId, { title: 'vault-data', url: '#', icon: '', desc: blob, tags: [], newTab: false, useFavicon: false } as any)
      }
      store.updatePersonalSection(sectionId, { subtitle: next.length === 0 ? 'Kosong' : `${next.length} kata sandi` })
      store.syncPersonalToDb()
    } catch (e) { console.warn('vault persist failed', e) }
  }, [sectionId])

  // ── Create master PIN (first run) ───────────────────────────
  const handleCreate = async () => {
    if (pin.length < 6) { setErr('PIN minimal 6 karakter'); return }
    if (pin !== pin2)   { setErr('PIN tidak cocok'); return }
    setBusy(true); setErr('')
    const ok = await createVault(pin)
    setBusy(false)
    if (!ok) { setErr('Gagal membuat brankas. Coba lagi.'); return }
    setHasVault(true); setLocked(false); setEntries([])
    setPin(''); setPin2(''); resetIdle()
  }

  // ── Unlock ──────────────────────────────────────────────────
  const handleUnlock = async () => {
    if (lockoutRem > 0 || !pin) return
    setBusy(true); setErr('')
    const ok = await unlockVault(pin)
    setBusy(false)
    if (ok) {
      failsRef.current = 0
      const store = useStore.getState()
      const blob = store.personalSections.find(x => x.id === sectionId)?.items?.[0]?.desc ?? ''
      const list = await decryptVault(blob)
      setEntries(list); setLocked(false); setPin(''); resetIdle()
    } else {
      // Vault wiped elsewhere (e.g. superadmin reset) → go to first-run, not "wrong PIN".
      if (!(await vaultExists())) { setHasVault(false); setPin(''); setErr(''); failsRef.current = 0; return }
      failsRef.current += 1
      const n = failsRef.current
      setPin('')
      if (n >= 6)      { setLockoutUntil(Date.now() + 5 * 60_000); setErr('Terlalu banyak percobaan. Tunggu 5 menit.') }
      else if (n >= 3) { setLockoutUntil(Date.now() + 30_000);     setErr('Terlalu banyak percobaan. Tunggu 30 detik.') }
      else             { setErr(`PIN salah. ${3 - n} percobaan tersisa.`) }
    }
  }

  // ── Entry actions ───────────────────────────────────────────
  const addEntry = () => {
    if (!form.label.trim() && !form.username.trim()) return
    const e: VaultEntry = {
      id: crypto.randomUUID(), label: form.label.trim() || form.url.trim() || 'Tanpa nama',
      username: form.username.trim(), password: form.password,
      url: form.url.trim() || undefined, updatedAt: Date.now(),
    }
    persist([e, ...entries])
    setForm({ label: '', username: '', password: '', url: '' }); setShowGen(false)
    resetIdle()
  }
  const saveEdit = (id: string, patch: Partial<VaultEntry>) => {
    persist(entries.map(e => e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e))
    setEditId(null); resetIdle()
  }
  const deleteEntry = (id: string) => { persist(entries.filter(e => e.id !== id)); setConfirmDel(null) }

  const copyPw = async (e: VaultEntry) => {
    try {
      await navigator.clipboard.writeText(e.password)
      setCopiedId(e.id)
      if (clipTimer.current) clearTimeout(clipTimer.current)
      // Auto-clear the clipboard after 20s (best effort).
      clipTimer.current = setTimeout(() => { navigator.clipboard.writeText('').catch(() => {}); setCopiedId(null) }, 20_000)
      setTimeout(() => setCopiedId(c => (c === e.id ? null : c)), 1500)
    } catch { /* clipboard blocked */ }
    resetIdle()
  }

  const useGenerated = () => { setForm(f => ({ ...f, password: genPassword(genLen, genOpts) })); setShowGen(false) }

  const closeChangePin = () => { setCpOpen(false); setCp1(''); setCp2(''); setCpErr('') }

  // Re-key to a new PIN while keeping every stored password (re-encrypts the
  // current in-memory entries with the new key). Only available while unlocked.
  const doChangePin = async () => {
    if (cp1.length < 6) { setCpErr(t('v.pinmin')); return }
    if (cp1 !== cp2)    { setCpErr(t('v.pinmismatch')); return }
    setCpBusy(true); setCpErr('')
    const ok = await changePin(cp1)
    if (ok) { await persist(entries) }   // re-encrypt with the new key — nothing is wiped
    setCpBusy(false)
    if (!ok) { setCpErr(t('v.pinfailed')); return }
    closeChangePin()
    useStore.getState().toast(t('v.pinkept'), 'success')
    resetIdle()
  }

  // Forgot-PIN reset is NOT a bare button — it must re-authenticate through the
  // user's linked Google account (Google enforces its own 2FA on prompt=login).
  // The actual wipe runs in authStore after the redirect returns.
  const startGoogleReset = async () => {
    setBusy(true)
    sessionStorage.setItem('vault-reset-pending', JSON.stringify({ sectionId, at: Date.now() }))
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { queryParams: { prompt: 'login' }, redirectTo: window.location.origin },
    })
    if (error) { sessionStorage.removeItem('vault-reset-pending'); setBusy(false); setErr('Gagal membuka login Google.') }
    // success → browser redirects to Google
  }


  // ── Styles ──────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', height: 34, padding: '0 10px', boxSizing: 'border-box',
    background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7,
    fontSize: 12, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none',
  }
  const overlay: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 22, minHeight: 220, textAlign: 'center',
  }

  // PIN field with a show/hide eye toggle.
  const renderPin = (p: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean; onEnter?: () => void }) => (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type={showPin ? 'text' : 'password'}
        value={p.value} autoFocus={p.autoFocus}
        autoComplete="new-password" spellCheck={false} data-lpignore="true" data-1p-ignore=""
        onChange={e => { p.onChange(e.target.value); setErr('') }}
        onKeyDown={e => { if (e.key === 'Enter' && p.onEnter) p.onEnter() }}
        placeholder={p.placeholder}
        style={{ ...inp, paddingRight: 36, borderColor: err ? 'var(--red)' : 'var(--border2)' }}
      />
      <button type="button" onClick={() => setShowPin(v => !v)} title={showPin ? 'Sembunyikan' : 'Tampilkan'}
        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)', display: 'flex', alignItems: 'center', padding: 3 }}>
        {showPin ? <IconEyeOff size={15} /> : <IconEye size={15} />}
      </button>
    </div>
  )

  const googleEmail = (profile as any)?.google_email as string | undefined

  // ── Render: loading ─────────────────────────────────────────
  if (hasVault === null) {
    return <div style={{ minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 22, height: 22, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  }

  // ── Render: first-run (set master PIN) ──────────────────────
  if (!hasVault) {
    return (
      <div style={overlay}>
        <span style={{ color: 'var(--accent)', display: 'flex' }}><IconLock size={28} /></span>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--silver)' }}>{t("v.createpin")}</div>
        <div style={{ fontSize: 11, color: 'var(--silver4)', lineHeight: 1.5, maxWidth: 240 }}>
          Min. 6 karakter. Mengenkripsi semua kata sandi. <b>Tidak bisa dipulihkan tanpa PIN ini.</b>
        </div>
        {renderPin({ value: pin, onChange: setPin, placeholder: 'PIN baru' })}
        {renderPin({ value: pin2, onChange: setPin2, placeholder: 'Konfirmasi PIN', onEnter: handleCreate })}
        {err && <span style={{ fontSize: 11, color: 'var(--red)' }}>{err}</span>}
        <button onClick={handleCreate} disabled={busy || pin.length < 6}
          style={{ width: '100%', height: 34, background: pin.length >= 6 ? 'var(--accent)' : 'var(--border2)', border: 'none', borderRadius: 7, color: 'white', fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font)' }}>
          {busy ? 'Membuat...' : 'Buat brankas'}
        </button>
      </div>
    )
  }

  // ── Render: locked ──────────────────────────────────────────
  if (locked) {
    return (
      <div style={overlay}>
        <span style={{ color: 'var(--silver3)', display: 'flex' }}><IconLock size={28} /></span>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--silver)' }}>{t("v.locked")}</div>
        {lockoutRem > 0 ? (
          <span style={{ fontSize: 11, color: 'var(--red)' }}>Coba lagi dalam {lockoutRem}s</span>
        ) : (
          <>
            {renderPin({ value: pin, onChange: setPin, placeholder: 'PIN brankas', autoFocus: true, onEnter: handleUnlock })}
            {err && <span style={{ fontSize: 11, color: 'var(--red)' }}>{err}</span>}
          </>
        )}
        <button onClick={handleUnlock} disabled={busy || !pin || lockoutRem > 0}
          style={{ width: '100%', height: 34, background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'white', fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font)', opacity: (!pin || lockoutRem > 0) ? 0.6 : 1 }}>
          {busy ? t("v.opening") : t("v.open")}
        </button>

        {/* Forgot PIN → reset ONLY via Google re-auth (2FA enforced by Google) */}
        <div style={{ width: '100%', marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {googleEmail ? (
            <>
              <button onClick={startGoogleReset} disabled={busy} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', height: 32, background: 'none', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--silver2)', fontSize: 11, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
                Lupa PIN? Reset lewat Akun Google
              </button>
              <span style={{ fontSize: 9.5, color: 'var(--silver4)', lineHeight: 1.4 }}>
                Verifikasi ulang Google (+ 2FA) wajib. Reset menghapus semua kata sandi permanen.
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--green, #16A34A)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                ✓ Tersinkron: {googleEmail}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--silver4)', lineHeight: 1.4 }}>
              Lupa PIN? Hubungkan <b>Akun Google</b> di Profil dulu untuk bisa reset brankas dengan aman.
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── Render: unlocked vault ──────────────────────────────────
  const filtered = query.trim()
    ? entries.filter(e => (e.label + ' ' + e.username + ' ' + (e.url ?? '')).toLowerCase().includes(query.toLowerCase()))
    : entries

  const miniInp: React.CSSProperties = { height: 28, padding: '0 9px', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 11.5, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none', minWidth: 0 }
  const miniBtn: React.CSSProperties = { width: 28, height: 28, flexShrink: 0, borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--silver3)' }
  const canAdd = !!(form.label.trim() || form.username.trim())
  // Keep the browser's own autofill/password manager OUT of the vault fields.
  const noAutofill: any = { autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: false, 'data-lpignore': 'true', 'data-1p-ignore': '', 'data-form-type': 'other' }
  const noAutofillPw: any = { ...noAutofill, autoComplete: 'new-password' }

  return (
    <div onPointerDown={resetIdle} onKeyDown={resetIdle} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px' }}>
      {/* Privacy screen — hides entries the moment the window loses focus */}
      {blurred && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--silver4)' }}>
          <span style={{ color: 'var(--silver3)', display: 'flex' }}><IconLock size={22} /></span>
          <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)' }}>{t("v.hidden")}</span>
        </div>
      )}
      {/* Sticky top: toolbar (search · +add · lock) + collapsible add form */}
      <div style={{ position: 'sticky', top: 0, zIndex: 3, background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 4 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver4)', display: 'flex', pointerEvents: 'none' }}><IconSearch size={13} /></span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("v.search")} {...noAutofill} style={{ ...inp, height: 30, paddingLeft: 28 }} />
          </div>
          <button onClick={() => { if (showAdd) { setShowAdd(false); setShowGen(false); setForm({ label: '', username: '', password: '', url: '' }) } else setShowAdd(true) }}
            title={showAdd ? 'Tutup' : 'Tambahkan password'}
            style={{ ...toolBtn, background: showAdd ? 'var(--accent)' : 'var(--bg4)', border: showAdd ? 'none' : '1px solid var(--border2)', color: showAdd ? 'white' : 'var(--silver3)' }}>
            <span style={{ display: 'flex', transition: 'transform 220ms cubic-bezier(.34,1.56,.64,1)', transform: showAdd ? 'rotate(45deg)' : 'none' }}><IconPlus size={15} /></span>
          </button>
          <button onClick={() => { if (cpOpen) closeChangePin(); else { setCpOpen(true); setShowAdd(false) } }}
            title={t("v.changepin")}
            style={{ ...toolBtn, background: cpOpen ? 'var(--accent)' : 'var(--bg4)', border: cpOpen ? 'none' : '1px solid var(--border2)', color: cpOpen ? 'white' : 'var(--silver3)' }}>
            <IconKey size={14} />
          </button>
          <button onClick={doLock} title={t("v.lock")} style={toolBtn}><IconLock size={14} /></button>
        </div>

        {/* Change PIN — re-encrypts in place; passwords are NEVER wiped */}
        {cpOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 8, background: 'var(--bg4)', border: '1px solid var(--accent-soft)', borderRadius: 8, flexShrink: 0, animation: 'slideDown 150ms ease' }}>
            <div style={{ fontSize: 10.5, color: 'var(--silver3)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconKey size={12} /> {t("v.changepin")}
            </div>
            <input value={cp1} onChange={e => { setCp1(e.target.value); setCpErr('') }} placeholder={t("v.newpin")} type="password" autoFocus {...noAutofillPw} style={{ ...miniInp, height: 30 }} />
            <input value={cp2} onChange={e => { setCp2(e.target.value); setCpErr('') }} placeholder={t("v.confirmpin")} type="password" {...noAutofillPw}
              onKeyDown={e => { if (e.key === 'Enter') doChangePin() }} style={{ ...miniInp, height: 30 }} />
            {cpErr && <span style={{ fontSize: 10.5, color: 'var(--red)' }}>{cpErr}</span>}
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={closeChangePin} style={{ flex: 1, height: 28, background: 'none', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>{t("cancel")}</button>
              <button onClick={doChangePin} disabled={cpBusy || cp1.length < 6}
                style={{ flex: 2, height: 28, background: cp1.length >= 6 ? 'var(--accent)' : 'var(--border2)', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 700, cursor: cpBusy ? 'wait' : 'pointer', fontFamily: 'var(--font)' }}>
                {cpBusy ? t("v.opening") : t("save")}
              </button>
            </div>
          </div>
        )}

        {/* Collapsible add form */}
        {showAdd && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 6, background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 8, flexShrink: 0, animation: 'slideDown 150ms ease' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder={t("v.sitename")} autoFocus {...noAutofill} style={{ ...miniInp, flex: 1 }} />
              <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder={t("v.username")} {...noAutofill} style={{ ...miniInp, flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && canAdd) addEntry() }}
                placeholder={t("v.password")} type={showPw ? 'text' : 'password'} {...noAutofillPw} style={{ ...miniInp, flex: 1 }} />
              <button onClick={() => setShowPw(v => !v)} title={showPw ? 'Sembunyikan' : 'Tampilkan'} style={miniBtn}>{showPw ? <IconEyeOff size={13} /> : <IconEye size={13} />}</button>
              <button onClick={() => setShowGen(v => !v)} title="Buat kata sandi" style={{ ...miniBtn, color: showGen ? 'var(--accent)' : 'var(--silver3)' }}><IconRefresh size={13} /></button>
              <button onClick={addEntry} disabled={!canAdd} title="Simpan" style={{ ...miniBtn, background: canAdd ? 'var(--accent)' : 'var(--bg)', border: canAdd ? 'none' : '1px solid var(--border2)', color: canAdd ? 'white' : 'var(--silver4)', cursor: canAdd ? 'pointer' : 'not-allowed' }}><IconCheck size={14} /></button>
            </div>
            {form.password && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${strength(form.password).pct}%`, height: '100%', background: strength(form.password).color, transition: 'width 200ms' }} />
                </div>
                <span style={{ fontSize: 8.5, color: strength(form.password).color, fontFamily: 'var(--mono)' }}>{strength(form.password).label}</span>
              </div>
            )}
            {showGen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9.5, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>{genLen}</span>
                <input type="range" min={8} max={32} value={genLen} onChange={e => setGenLen(+e.target.value)} style={{ flex: 1, minWidth: 70, accentColor: 'var(--accent)' }} />
                {([['upper', 'A'], ['digit', '0'], ['symbol', '#']] as const).map(([k, lbl]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, color: 'var(--silver3)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={genOpts[k]} onChange={e => setGenOpts(o => ({ ...o, [k]: e.target.checked }))} style={{ accentColor: 'var(--accent)' }} />{lbl}
                  </label>
                ))}
                <button onClick={useGenerated} style={{ height: 22, padding: '0 9px', background: 'var(--accent)', border: 'none', borderRadius: 5, color: 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Pakai</button>
              </div>
            )}
          </div>
        )}
      </div>
      {err && <div style={{ fontSize: 11, color: 'var(--red)' }}>{err}</div>}

      {/* Entry list */}
      <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--silver4)', textAlign: 'center', padding: '14px 0' }}>
            {entries.length === 0 ? 'Belum ada kata sandi. Tambah atau impor CSV.' : 'Tidak ada hasil.'}
          </div>
        )}
        {filtered.map(e => {
          const isRev = revealed.has(e.id)
          const isEdit = editId === e.id
          if (isEdit) return (
            <EntryEditor key={e.id} entry={e} onCancel={() => setEditId(null)} onSave={p => saveEdit(e.id, p)} />
          )
          return (
            <div key={e.id} style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.label}</div>
                  {e.username && <div style={{ fontSize: 10.5, color: 'var(--silver4)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.username}</div>}
                </div>
                <button onClick={() => copyPw(e)} title="Salin kata sandi" style={{ ...iconBtn, color: copiedId === e.id ? 'var(--green, #16A34A)' : 'var(--silver3)' }}>{copiedId === e.id ? <IconCheck size={14} /> : <IconCopy size={14} />}</button>
                <button onClick={() => setEditId(e.id)} title="Edit" style={iconBtn}><IconEdit size={14} /></button>
                <button onClick={() => setConfirmDel(e.id)} title="Hapus" style={iconBtn}><IconTrash size={14} /></button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                <code style={{ flex: 1, fontSize: 12, color: 'var(--silver2)', fontFamily: 'var(--mono)', letterSpacing: isRev ? 0 : 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isRev ? (e.password || '—') : '••••••••••'}
                </code>
                <button onClick={() => setRevealed(s => { const n = new Set(s); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })}
                  title={isRev ? 'Sembunyikan' : 'Tampilkan'} style={iconBtn}>{isRev ? <IconEyeOff size={14} /> : <IconEye size={14} />}</button>
                {e.url && <a href={/^https?:\/\//.test(e.url) ? e.url : `https://${e.url}`} target="_blank" rel="noopener noreferrer" title="Buka situs" style={{ ...iconBtn, textDecoration: 'none' }}><IconGlobe size={14} /></a>}
              </div>
              {e.updatedAt && (
                <div style={{ fontSize: 9, color: 'var(--silver4)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                  Diubah · {fmtModified(e.updatedAt)}
                </div>
              )}
              {confirmDel === e.id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--red)', flex: 1 }}>Hapus kata sandi ini?</span>
                  <button onClick={() => setConfirmDel(null)} style={{ height: 22, padding: '0 8px', background: 'none', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--silver3)', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font)' }}>Batal</button>
                  <button onClick={() => deleteEntry(e.id)} style={{ height: 22, padding: '0 8px', background: 'var(--red)', border: 'none', borderRadius: 5, color: 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Hapus</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}

// Inline editor for an existing entry — a single compact row (label · username ·
// password · save/cancel). The URL is preserved untouched. Password is editable
// right here; nothing is removed.
function EntryEditor({ entry, onSave, onCancel }: { entry: VaultEntry; onSave: (p: Partial<VaultEntry>) => void; onCancel: () => void }) {
  const t = useT()
  const [f, setF] = useState({ label: entry.label, username: entry.username, password: entry.password })
  const mini: React.CSSProperties = { height: 30, padding: '0 8px', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 11.5, color: 'var(--silver)', fontFamily: 'var(--font)', outline: 'none', minWidth: 0 }
  const btn: React.CSSProperties = { width: 30, height: 30, flexShrink: 0, borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--silver3)' }
  const noAf: any = { autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: false, 'data-lpignore': 'true', 'data-1p-ignore': '' }
  const save = () => onSave({ label: f.label.trim() || 'Tanpa nama', username: f.username.trim(), password: f.password, url: entry.url })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: 6, background: 'var(--bg4)', border: '1px solid var(--accent-soft)', borderRadius: 8 }}>
      <input value={f.label} onChange={e => setF(s => ({ ...s, label: e.target.value }))} placeholder={t('v.sitename')} {...noAf} style={{ ...mini, flex: '1 1 0', minWidth: 44 }} />
      <input value={f.username} onChange={e => setF(s => ({ ...s, username: e.target.value }))} placeholder={t('v.username')} {...noAf} style={{ ...mini, flex: '1 1 0', minWidth: 44 }} />
      <input value={f.password} onChange={e => setF(s => ({ ...s, password: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') save() }} placeholder={t('v.password')} autoFocus {...noAf} autoComplete="new-password" style={{ ...mini, flex: '2 1 0', minWidth: 56 }} />
      <button onClick={onCancel} title={t('cancel')} style={btn}>✕</button>
      <button onClick={save} title={t('save')} style={{ ...btn, background: 'var(--accent)', border: 'none', color: 'white' }}><IconCheck size={14} /></button>
    </div>
  )
}

const toolBtn: React.CSSProperties = {
  width: 30, height: 30, flexShrink: 0, borderRadius: 7, border: '1px solid var(--border2)',
  background: 'var(--bg4)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const iconBtn: React.CSSProperties = {
  width: 26, height: 26, flexShrink: 0, borderRadius: 6, border: 'none',
  background: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
}

export default memo(PasswordVaultWidgetImpl)
