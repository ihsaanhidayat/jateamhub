import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { useStore } from '../../store/dashboardStore'
import { useAuthStore } from '../../store/authStore'
import {
  vaultExists, createVault, unlockVault, encryptVault, decryptVault,
  isVaultUnlocked, clearVaultSession, resetVault,
} from '../../utils/vaultCrypto'
import type { VaultEntry } from '../../types'

const fmtModified = (ms?: number) =>
  ms ? new Date(ms).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : ''

const IDLE_MS = 5 * 60_000

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

// ── CSV import (Chrome/Edge/Firefox export: name,url,username,password,note) ──
function parseCsv(text: string): VaultEntry[] {
  const rows: string[][] = []
  let row: string[] = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false }
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (cur !== '' || row.length) { row.push(cur); rows.push(row); row = []; cur = '' } if (c === '\r' && text[i + 1] === '\n') i++ }
    else cur += c
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  if (!rows.length) return []
  const head = rows[0].map(h => h.trim().toLowerCase())
  const idx = (names: string[]) => names.map(n => head.indexOf(n)).find(i => i >= 0) ?? -1
  const iName = idx(['name', 'title']), iUrl = idx(['url', 'website']), iUser = idx(['username', 'login', 'email']), iPw = idx(['password']), iNote = idx(['note', 'notes', 'comment'])
  const out: VaultEntry[] = []
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r]
    const password = iPw >= 0 ? (cols[iPw] ?? '') : ''
    const label = (iName >= 0 ? cols[iName] : '') || (iUrl >= 0 ? cols[iUrl] : '') || 'Tanpa nama'
    if (!password && !(iUser >= 0 && cols[iUser])) continue
    out.push({
      id: crypto.randomUUID(), label: label.trim(),
      username: (iUser >= 0 ? cols[iUser] : '')?.trim() ?? '',
      password, url: (iUrl >= 0 ? cols[iUrl] : '')?.trim() || undefined,
      note: (iNote >= 0 ? cols[iNote] : '')?.trim() || undefined,
      updatedAt: Date.now(),
    })
  }
  return out
}

function PasswordVaultWidgetImpl({ sectionId }: { sectionId: string }) {
  const { profile } = useAuthStore()
  const setNotesLockActive = useStore(s => (s as any).setNotesLockActive)

  const [hasVault, setHasVault] = useState<boolean | null>(null)
  const [locked,   setLocked]   = useState(true)
  const [entries,  setEntries]  = useState<VaultEntry[]>([])
  const [pin,      setPin]      = useState('')
  const [pin2,     setPin2]     = useState('')
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

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
  const [showAdd, setShowAdd] = useState(false)
  const [showGen, setShowGen] = useState(false)
  const [genLen,  setGenLen]  = useState(16)
  const [genOpts, setGenOpts] = useState({ upper: true, digit: true, symbol: true })

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  const doLock = useCallback(() => {
    clearVaultSession()
    setLocked(true); setEntries([]); setRevealed(new Set())
    setEditId(null); setShowAdd(false); setShowGen(false)
    setForm({ label: '', username: '', password: '', url: '' })
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

  // Lock on background + logout; cleanup timers
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'hidden' && isVaultUnlocked()) doLock() }
    const onLogout = () => doLock()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('jateamhub-logout', onLogout)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('jateamhub-logout', onLogout)
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
    setForm({ label: '', username: '', password: '', url: '' }); setShowAdd(false); setShowGen(false)
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

  // Forgot-PIN: wipe the vault (entries unrecoverable) and return to setup.
  const handleReset = async () => {
    setBusy(true)
    await resetVault()
    const store = useStore.getState()
    const s = store.personalSections.find(x => x.id === sectionId)
    if (s?.items?.length) store.updateItem(sectionId, s.items[0].id, { ...s.items[0], desc: '' })
    store.updatePersonalSection(sectionId, { subtitle: '' })
    store.syncPersonalToDb()
    setBusy(false); setConfirmReset(false)
    setHasVault(false); setLocked(true); setEntries([]); setPin(''); setErr('')
  }

  const onImport = async (file: File) => {
    const text = await file.text()
    const imported = parseCsv(text)
    if (!imported.length) { setErr('Tidak ada data yang dikenali di CSV.'); setTimeout(() => setErr(''), 3000); return }
    persist([...imported, ...entries])
    resetIdle()
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
        <span style={{ fontSize: 30 }}>🔐</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--silver)' }}>Buat PIN Brankas</div>
        <div style={{ fontSize: 11, color: 'var(--silver4)', lineHeight: 1.5, maxWidth: 240 }}>
          Min. 6 karakter. Mengenkripsi semua kata sandi. <b>Tidak bisa dipulihkan tanpa PIN ini.</b>
        </div>
        <input type="password" value={pin} onChange={e => { setPin(e.target.value); setErr('') }} placeholder="PIN baru"
          style={{ ...inp, borderColor: err ? 'var(--red)' : 'var(--border2)' }} />
        <input type="password" value={pin2} onChange={e => { setPin2(e.target.value); setErr('') }}
          onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder="Konfirmasi PIN"
          style={{ ...inp, borderColor: err ? 'var(--red)' : 'var(--border2)' }} />
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
        <span style={{ fontSize: 30 }}>🔒</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--silver)' }}>Brankas Terkunci</div>
        {lockoutRem > 0 ? (
          <span style={{ fontSize: 11, color: 'var(--red)' }}>Coba lagi dalam {lockoutRem}s</span>
        ) : (
          <>
            <input type="password" value={pin} autoFocus
              onChange={e => { setPin(e.target.value); setErr('') }}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()} placeholder="PIN brankas"
              style={{ ...inp, borderColor: err ? 'var(--red)' : 'var(--border2)' }} />
            {err && <span style={{ fontSize: 11, color: 'var(--red)' }}>{err}</span>}
          </>
        )}
        <button onClick={handleUnlock} disabled={busy || !pin || lockoutRem > 0}
          style={{ width: '100%', height: 34, background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'white', fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font)', opacity: (!pin || lockoutRem > 0) ? 0.6 : 1 }}>
          {busy ? 'Membuka...' : 'Buka'}
        </button>

        {/* Forgot PIN → wipe reset */}
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver4)', fontSize: 10.5, textDecoration: 'underline', fontFamily: 'var(--font)' }}>
            Lupa PIN? Reset brankas
          </button>
        ) : (
          <div style={{ width: '100%', padding: 9, background: 'color-mix(in srgb, var(--red) 7%, var(--bg4))', border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{ fontSize: 10.5, color: 'var(--red)', lineHeight: 1.45 }}>
              Reset menghapus <b>semua kata sandi</b> di brankas ini secara permanen. Lanjutkan?
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setConfirmReset(false)} disabled={busy} style={{ flex: 1, height: 28, background: 'none', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--silver3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Batal</button>
              <button onClick={handleReset} disabled={busy} style={{ flex: 1, height: 28, background: 'var(--red)', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'var(--font)' }}>{busy ? '...' : 'Reset'}</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Render: unlocked vault ──────────────────────────────────
  const filtered = query.trim()
    ? entries.filter(e => (e.label + ' ' + e.username + ' ' + (e.url ?? '')).toLowerCase().includes(query.toLowerCase()))
    : entries

  return (
    <div onPointerDown={resetIdle} onKeyDown={resetIdle} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="🔍 Cari..." style={{ ...inp, height: 30, flex: 1 }} />
        <button onClick={() => fileRef.current?.click()} title="Impor CSV" style={toolBtn}>⬆️</button>
        <button onClick={doLock} title="Kunci" style={toolBtn}>🔒</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImport(f) }} />
      </div>
      {err && <div style={{ fontSize: 11, color: 'var(--red)' }}>{err}</div>}

      {/* Entry list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--silver4)', textAlign: 'center', padding: '14px 0' }}>
            {entries.length === 0 ? 'Belum ada kata sandi. Tambah atau impor CSV.' : 'Tidak ada hasil.'}
          </div>
        )}
        {filtered.map(e => {
          const isRev = revealed.has(e.id)
          const isEdit = editId === e.id
          if (isEdit) return (
            <EntryEditor key={e.id} entry={e} inp={inp} onCancel={() => setEditId(null)} onSave={p => saveEdit(e.id, p)} />
          )
          return (
            <div key={e.id} style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--silver)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.label}</div>
                  {e.username && <div style={{ fontSize: 10.5, color: 'var(--silver4)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.username}</div>}
                </div>
                <button onClick={() => copyPw(e)} title="Salin kata sandi" style={iconBtn}>{copiedId === e.id ? '✓' : '📋'}</button>
                <button onClick={() => setEditId(e.id)} title="Edit" style={iconBtn}>✏️</button>
                <button onClick={() => setConfirmDel(e.id)} title="Hapus" style={iconBtn}>✕</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                <code style={{ flex: 1, fontSize: 12, color: 'var(--silver2)', fontFamily: 'var(--mono)', letterSpacing: isRev ? 0 : 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isRev ? (e.password || '—') : '••••••••••'}
                </code>
                <button onClick={() => setRevealed(s => { const n = new Set(s); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })}
                  title={isRev ? 'Sembunyikan' : 'Tampilkan'} style={iconBtn}>{isRev ? '🙈' : '👁'}</button>
                {e.url && <a href={/^https?:\/\//.test(e.url) ? e.url : `https://${e.url}`} target="_blank" rel="noopener noreferrer" title="Buka situs" style={{ ...iconBtn, textDecoration: 'none' }}>🌐</a>}
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

      {/* Add form */}
      {showAdd ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 8, animation: 'slideDown 150ms ease' }}>
          <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Nama situs / aplikasi" autoFocus style={inp} />
          <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Username / email" style={inp} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Kata sandi" style={{ ...inp, flex: 1 }} />
            <button onClick={() => setShowGen(v => !v)} title="Buat kata sandi" style={{ ...toolBtn, width: 34 }}>🎲</button>
          </div>
          {form.password && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${strength(form.password).pct}%`, height: '100%', background: strength(form.password).color, transition: 'width 200ms' }} />
              </div>
              <span style={{ fontSize: 9, color: strength(form.password).color, fontFamily: 'var(--mono)' }}>{strength(form.password).label}</span>
            </div>
          )}
          {showGen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 7, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--silver4)', fontFamily: 'var(--mono)' }}>Panjang {genLen}</span>
                <input type="range" min={8} max={32} value={genLen} onChange={e => setGenLen(+e.target.value)} style={{ flex: 1, accentColor: 'var(--accent)' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {([['upper', 'A-Z'], ['digit', '0-9'], ['symbol', '!@#']] as const).map(([k, lbl]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--silver3)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={genOpts[k]} onChange={e => setGenOpts(o => ({ ...o, [k]: e.target.checked }))} style={{ accentColor: 'var(--accent)' }} /> {lbl}
                  </label>
                ))}
                <button onClick={useGenerated} style={{ marginLeft: 'auto', height: 24, padding: '0 10px', background: 'var(--accent)', border: 'none', borderRadius: 5, color: 'white', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Pakai</button>
              </div>
            </div>
          )}
          <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="URL (opsional)" style={inp} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setShowAdd(false); setShowGen(false); setForm({ label: '', username: '', password: '', url: '' }) }} style={{ flex: 1, height: 30, background: 'none', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--silver3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Batal</button>
            <button onClick={addEntry} style={{ flex: 2, height: 30, background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Simpan</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} style={{ height: 32, background: 'var(--accent-light)', border: '1px dashed var(--accent-soft)', borderRadius: 7, color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
          ＋ Tambah kata sandi
        </button>
      )}
    </div>
  )
}

// Inline editor for an existing entry.
function EntryEditor({ entry, inp, onSave, onCancel }: { entry: VaultEntry; inp: React.CSSProperties; onSave: (p: Partial<VaultEntry>) => void; onCancel: () => void }) {
  const [f, setF] = useState({ label: entry.label, username: entry.username, password: entry.password, url: entry.url ?? '' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: 'var(--bg4)', border: '1px solid var(--accent-soft)', borderRadius: 8 }}>
      <input value={f.label} onChange={e => setF(s => ({ ...s, label: e.target.value }))} placeholder="Nama" autoFocus style={inp} />
      <input value={f.username} onChange={e => setF(s => ({ ...s, username: e.target.value }))} placeholder="Username / email" style={inp} />
      <input value={f.password} onChange={e => setF(s => ({ ...s, password: e.target.value }))} placeholder="Kata sandi" style={inp} />
      <input value={f.url} onChange={e => setF(s => ({ ...s, url: e.target.value }))} placeholder="URL (opsional)" style={inp} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onCancel} style={{ flex: 1, height: 30, background: 'none', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--silver3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Batal</button>
        <button onClick={() => onSave({ label: f.label.trim() || 'Tanpa nama', username: f.username.trim(), password: f.password, url: f.url.trim() || undefined })}
          style={{ flex: 2, height: 30, background: 'var(--accent)', border: 'none', borderRadius: 7, color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>Simpan</button>
      </div>
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
