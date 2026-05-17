// ─────────────────────────────────────────────────────────────
// REGISTER PAGE — Form pendaftaran user baru
// Data masuk ke pending_registrations, menunggu approval admin
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { submitRegistration } from '../../utils/supabaseClient'
import { REGIONS, UNITS } from '../../types'

interface Props { onBack: () => void }

// Validasi nomor HP Indonesia (08xx)
const isValidPhone = (p: string) => /^08[0-9]{8,12}$/.test(p.replace(/\s/g, ''))

export default function RegisterPage({ onBack }: Props) {
  const [step,       setStep]       = useState<'form' | 'success'>('form')
  const [loading,    setLoading]    = useState(false)
  const [err,        setErr]        = useState('')

  // Form fields
  const [fullName,   setFullName]   = useState('')
  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [phone,      setPhone]      = useState('')
  const [region,     setRegion]     = useState('')
  const [unit,       setUnit]       = useState('')

  const handleSubmit = async () => {
    setErr('')

    // Validasi semua field mandatory
    if (!fullName.trim())  return setErr('Nama lengkap wajib diisi.')
    if (!username.trim())  return setErr('Username wajib diisi.')
    if (username.includes(' ')) return setErr('Username tidak boleh mengandung spasi.')
    if (!password || password.length < 6) return setErr('Password minimal 6 karakter.')
    if (!isValidPhone(phone)) return setErr('Nomor HP tidak valid. Gunakan format 08xxxxxxxxxx.')
    if (!region)           return setErr('Wilayah wajib dipilih.')
    if (!unit)             return setErr('Unit wajib dipilih.')

    setLoading(true)
    try {
      const { error } = await submitRegistration({
        full_name:     fullName.trim(),
        username:      username.trim().toLowerCase(),
        phone:         phone.trim(),
        region_scope:  region,
        unit_scope:    unit,
        temp_password: password,
      })
      if (error) {
        if ((error as any).code === '23505') setErr('Username sudah digunakan, pilih username lain.')
        else setErr('Gagal mengirim pendaftaran. Coba lagi.')
        setLoading(false)
        return
      }
      setStep('success')
    } catch {
      setErr('Terjadi kesalahan. Coba lagi.')
    }
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--glass)',
    border: '1px solid var(--border2)',
    borderRadius: 8, padding: '11px 14px',
    color: 'var(--silver)', fontSize: 14, fontFamily: 'var(--font)',
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--silver3)', textTransform: 'uppercase',
    letterSpacing: '1px', marginBottom: 6, fontFamily: 'var(--mono)',
  }

  if (step === 'success') return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border2)',
        borderRadius: 16, padding: '40px 32px', maxWidth: 400, width: '100%', textAlign: 'center',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>
          Pendaftaran Terkirim!
        </h2>
        <p style={{ fontSize: 13, color: 'var(--silver3)', lineHeight: 1.7, marginBottom: 28 }}>
          Pendaftaran kamu sudah diterima dan sedang menunggu persetujuan admin.
          Kamu akan dihubungi via WhatsApp setelah akun diaktifkan.
        </p>
        <button onClick={onBack} style={{
          width: '100%', padding: '12px', background: 'rgba(110,231,183,0.1)',
          border: '1px solid rgba(110,231,183,0.3)', borderRadius: 8,
          color: 'var(--accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)',
        }}>Kembali ke Login</button>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'var(--font)',
    }}>
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '36px 32px',
        maxWidth: 480, width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.5px', marginBottom: 6 }}>
            JateamHub
          </h1>
          <p style={{ fontSize: 13, color: 'var(--silver3)' }}>Daftar Akun Baru</p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Nama Lengkap */}
          <div>
            <label style={labelStyle}>Nama Lengkap *</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Contoh: Ihsan Hidayat" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#6EE7B7')}
              onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')} />
          </div>

          {/* Username */}
          <div>
            <label style={labelStyle}>Username *</label>
            <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              placeholder="Contoh: ihsan.hidayat" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#6EE7B7')}
              onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')} />
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>Password *</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#6EE7B7')}
              onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')} />
          </div>

          {/* No HP */}
          <div>
            <label style={labelStyle}>Nomor HP (WhatsApp) *</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx" type="tel" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#6EE7B7')}
              onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')} />
          </div>

          {/* Region + Unit */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Wilayah *</label>
              <select value={region} onChange={e => setRegion(e.target.value)}
                style={{ ...inputStyle, appearance: 'auto', color: region ? '#F1F5F9' : '#64748B' }}>
                <option value="" disabled>Pilih wilayah</option>
                {REGIONS.filter(r => r.value !== 'global').map(r => (
                  <option key={r.value} value={r.value} style={{ background: 'var(--bg3)' }}>{r.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Unit *</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                style={{ ...inputStyle, appearance: 'auto', color: unit ? '#F1F5F9' : '#64748B' }}>
                <option value="" disabled>Pilih unit</option>
                {UNITS.map(u => (
                  <option key={u.value} value={u.value} style={{ background: 'var(--bg3)' }}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, color: 'var(--red)', fontSize: 13,
          }}>{err}</div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', marginTop: 20, padding: '13px',
          background: loading ? 'rgba(110,231,183,0.3)' : 'rgba(110,231,183,0.15)',
          border: '1px solid rgba(110,231,183,0.4)',
          borderRadius: 8, color: 'var(--accent)', fontSize: 14, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
          transition: 'all 0.2s',
        }}>
          {loading ? 'Mengirim...' : 'Kirim Pendaftaran'}
        </button>

        {/* Back */}
        <button onClick={onBack} style={{
          width: '100%', marginTop: 10, padding: '11px',
          background: 'none', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, color: 'var(--silver3)', fontSize: 13, cursor: 'pointer',
          fontFamily: 'var(--font)',
        }}>← Kembali ke Login</button>

        {/* Info */}
        <p style={{ textAlign: 'center', fontSize: 11, color: '#475569', marginTop: 16, lineHeight: 1.6 }}>
          Pendaftaran akan diverifikasi oleh admin.<br/>
          Kamu akan dihubungi via WhatsApp setelah disetujui.
        </p>
      </div>
    </div>
  )
}
