// ─────────────────────────────────────────────────────────────
// REGISTER PAGE — Form pendaftaran + verifikasi OTP email
// Flow: isi form → kirim OTP ke email → verifikasi → submit
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { submitRegistration } from '../../utils/supabaseClient'
import { REGIONS, UNITS } from '../../types'
import { supabase } from '../../utils/supabaseClient'

interface Props { onBack: () => void }

const isValidPhone = (p: string) => /^08[0-9]{8,12}$/.test(p.replace(/\s/g, ''))
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

type Step = 'form' | 'otp' | 'success'

export default function RegisterPage({ onBack }: Props) {
  const [step,      setStep]      = useState<Step>('form')
  const [loading,   setLoading]   = useState(false)
  const [err,       setErr]       = useState('')

  // Form fields
  const [fullName,  setFullName]  = useState('')
  const [username,  setUsername]  = useState('')
  const [password,  setPassword]  = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [region,    setRegion]    = useState('')
  const [unit,      setUnit]      = useState('')

  // OTP
  const [otp,       setOtp]       = useState('')
  const [otpSent,   setOtpSent]   = useState(false)
  const [countdown, setCountdown] = useState(0)

  const startCountdown = () => {
    setCountdown(60)
    const t = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(t); return 0 }
      return c - 1
    }), 1000)
  }

  const sendOtp = async () => {
    if (!email || !isValidEmail(email)) return setErr('Email tidak valid.')
    setLoading(true); setErr('')
    try {
      const res = await supabase.functions.invoke('send-otp', {
        body: { email, type: 'register' }
      })
      if (res.error || res.data?.error) {
        setErr(res.data?.error ?? 'Gagal kirim OTP. Coba lagi.')
      } else {
        setOtpSent(true)
        setStep('otp')
        startCountdown()
      }
    } catch {
      setErr('Gagal kirim OTP. Coba lagi.')
    }
    setLoading(false)
  }

  const verifyAndSubmit = async () => {
    if (!otp || otp.length !== 6) return setErr('Masukkan 6 digit kode OTP.')
    setLoading(true); setErr('')
    try {
      // Verifikasi OTP
      const verifyRes = await supabase.functions.invoke('verify-otp', {
        body: { email, otp, type: 'register' }
      })
      if (verifyRes.error || !verifyRes.data?.verified) {
        setErr(verifyRes.data?.error ?? 'Kode OTP tidak valid atau sudah expired.')
        setLoading(false); return
      }

      // Submit pendaftaran
      const { error } = await submitRegistration({
        full_name:     fullName.trim(),
        username:      username.trim().toLowerCase(),
        phone:         phone.trim(),
        email:         email.trim().toLowerCase(),
        region_scope:  region,
        unit_scope:    unit,
        temp_password: password,
      } as any)

      if (error) {
        if ((error as any).code === '23505') setErr('Username sudah digunakan.')
        else setErr('Gagal mengirim pendaftaran. Coba lagi.')
        setLoading(false); return
      }
      setStep('success')
    } catch {
      setErr('Terjadi kesalahan. Coba lagi.')
    }
    setLoading(false)
  }

  const validateForm = () => {
    if (!fullName.trim())  return 'Nama lengkap wajib diisi.'
    if (!username.trim())  return 'Username wajib diisi.'
    if (username.includes(' ')) return 'Username tidak boleh mengandung spasi.'
    if (!password || password.length < 6) return 'Password minimal 6 karakter.'
    if (!isValidPhone(phone)) return 'Nomor HP tidak valid. Format: 08xxxxxxxxxx'
    if (!isValidEmail(email)) return 'Email tidak valid.'
    if (!region) return 'Wilayah wajib dipilih.'
    if (!unit)   return 'Unit wajib dipilih.'
    return null
  }

  const handleNext = () => {
    const e = validateForm()
    if (e) return setErr(e)
    setErr('')
    sendOtp()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg2)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-sm)', padding: '11px 14px',
    color: 'var(--silver)', fontSize: 14, fontFamily: 'var(--font)',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--silver3)', textTransform: 'uppercase',
    letterSpacing: '1px', marginBottom: 6, fontFamily: 'var(--mono)',
  }

  // ── SUCCESS ───────────────────────────────────────────────
  if (step === 'success') return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      fontFamily: 'var(--font)',
    }}>
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        borderRadius: 16, padding: '40px 32px',
        maxWidth: 400, width: '100%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>
          Pendaftaran Terkirim!
        </h2>
        <p style={{ fontSize: 13, color: 'var(--silver3)', lineHeight: 1.7, marginBottom: 28 }}>
          Email kamu sudah terverifikasi. Pendaftaran menunggu persetujuan admin.
          Kamu akan dihubungi setelah akun diaktifkan.
        </p>
        <button onClick={onBack} style={{
          width: '100%', padding: '12px', background: 'var(--accent)',
          border: 'none', borderRadius: 'var(--radius-sm)',
          color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>Kembali ke Login</button>
      </div>
    </div>
  )

  // ── OTP STEP ─────────────────────────────────────────────
  if (step === 'otp') return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'var(--font)',
    }}>
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        borderRadius: 16, padding: '36px 32px',
        maxWidth: 400, width: '100%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📧</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--silver)', margin: '0 0 8px' }}>
            Verifikasi Email
          </h2>
          <p style={{ fontSize: 13, color: 'var(--silver3)', margin: 0 }}>
            Kode OTP dikirim ke<br/>
            <strong style={{ color: 'var(--accent)' }}>{email}</strong>
          </p>
        </div>

        {/* OTP Input */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Kode OTP (6 digit)</label>
          <input
            value={otp}
            onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr('') }}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoFocus
            style={{
              ...inputStyle,
              textAlign: 'center', fontSize: 28, fontWeight: 800,
              letterSpacing: 12, fontFamily: 'var(--mono)',
            }}
          />
        </div>

        {err && (
          <div style={{
            padding: '10px 14px', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
            color: 'var(--red)', fontSize: 13, marginBottom: 16,
          }}>{err}</div>
        )}

        <button onClick={verifyAndSubmit} disabled={loading || otp.length !== 6} style={{
          width: '100%', padding: '13px', marginBottom: 10,
          background: otp.length === 6 ? 'var(--accent)' : 'var(--border2)',
          border: 'none', borderRadius: 'var(--radius-sm)',
          color: 'white', fontSize: 14, fontWeight: 700,
          cursor: otp.length === 6 ? 'pointer' : 'not-allowed',
        }}>{loading ? 'Memverifikasi...' : 'Verifikasi & Daftar'}</button>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--silver3)' }}>
          Tidak dapat kode?{' '}
          {countdown > 0
            ? <span>Kirim ulang dalam {countdown}s</span>
            : <span onClick={sendOtp} style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
                Kirim ulang
              </span>
          }
        </div>

        <button onClick={() => { setStep('form'); setOtp(''); setErr('') }} style={{
          width: '100%', marginTop: 12, padding: '11px',
          background: 'none', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-sm)', color: 'var(--silver3)',
          fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)',
        }}>← Kembali</button>
      </div>
    </div>
  )

  // ── FORM STEP ─────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'var(--font)',
    }}>
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        borderRadius: 16, padding: '36px 32px',
        maxWidth: 480, width: '100%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--silver)', marginBottom: 4 }}>
            JateamHub
          </h1>
          <p style={{ fontSize: 13, color: 'var(--silver3)' }}>Daftar Akun Baru</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Nama Lengkap *</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Muhammad Ihsan Hidayat" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border2)'} />
          </div>

          <div>
            <label style={labelStyle}>Username *</label>
            <input value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              placeholder="ihsan.hidayat" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border2)'} />
          </div>

          <div style={{ position: 'relative' }}>
            <label style={labelStyle}>Password *</label>
            <input type={showPw ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              style={{ ...inputStyle, paddingRight: 44 }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border2)'} />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{
              position: 'absolute', right: 10, top: 32,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--silver3)', fontSize: 14,
            }}>{showPw ? '🙈' : '👁'}</button>
          </div>

          <div>
            <label style={labelStyle}>Nomor HP *</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx" type="tel" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border2)'} />
          </div>

          <div>
            <label style={labelStyle}>Email * <span style={{ color: 'var(--silver3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(untuk verifikasi & reset password)</span></label>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="ihsan@email.com" type="email" style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border2)'} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Wilayah *</label>
              <select value={region} onChange={e => setRegion(e.target.value)}
                style={{ ...inputStyle, appearance: 'auto' }}>
                <option value="">Pilih wilayah</option>
                {REGIONS.filter(r => r.value !== 'global').map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Unit *</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                style={{ ...inputStyle, appearance: 'auto' }}>
                <option value="">Pilih unit</option>
                {UNITS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {err && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, color: 'var(--red)', fontSize: 13,
          }}>{err}</div>
        )}

        <button onClick={handleNext} disabled={loading} style={{
          width: '100%', marginTop: 20, padding: '13px',
          background: 'var(--accent)', border: 'none',
          borderRadius: 'var(--radius-sm)', color: 'white',
          fontSize: 14, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}>{loading ? 'Mengirim OTP...' : 'Lanjut → Verifikasi Email'}</button>

        <button onClick={onBack} style={{
          width: '100%', marginTop: 10, padding: '11px',
          background: 'none', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-sm)', color: 'var(--silver3)',
          fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)',
        }}>← Kembali ke Login</button>
      </div>
    </div>
  )
}
