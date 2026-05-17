export default function SupportPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: '40px 20px',
      gap: 0,
    }}>
      {/* Card */}
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border2)',
        borderRadius: 'var(--radius)',
        width: '100%',
        maxWidth: 420,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Header card */}
        <div style={{
          background: 'var(--bg3)',
          borderBottom: '1px solid var(--border)',
          padding: '24px 28px 20px',
          textAlign: 'center',
          borderLeft: '3px solid var(--accent)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>☕</div>
          <h2 style={{
            fontSize: 20, fontWeight: 700, color: 'var(--silver)',
            letterSpacing: '-0.3px', marginBottom: 6,
          }}>
            Traktir Kopi
          </h2>
          <p style={{ fontSize: 13, color: 'var(--silver3)', lineHeight: 1.5 }}>
            JateamHub dibuat dengan ❤️ dan banyak kopi.<br/>
            Kalau dashboard ini membantu pekerjaanmu,<br/>
            pertimbangkan untuk traktir secangkir.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Nominal info */}
          <div style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--silver3)', marginBottom: 2, letterSpacing: '.5px', textTransform: 'uppercase', fontWeight: 600 }}>
                Minimal
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
                Rp 10.000
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--silver3)', marginBottom: 2, letterSpacing: '.5px', textTransform: 'uppercase', fontWeight: 600 }}>
                Metode
              </div>
              <div style={{ fontSize: 13, color: 'var(--silver2)', fontWeight: 500 }}>
                QRIS & Transfer
              </div>
            </div>
          </div>

          {/* QRIS info */}
          <div style={{
            background: 'var(--mint-bg)',
            border: '1px solid var(--mint-bg)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            fontSize: 12,
            color: 'var(--silver3)',
            lineHeight: 1.6,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
            <span>
              QRIS tersedia langsung di halaman Lynk.id kami.
              Tidak perlu download app tambahan.
            </span>
          </div>

          {/* CTA Button */}
          <a
            href="https://lynk.id"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: 'var(--accent)',
              color: 'var(--black)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-sm)',
              padding: '13px 20px',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '.5px',
              textDecoration: 'none',
              transition: 'all .15s',
              fontFamily: 'var(--font)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--mint-dim)'
              ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--mint-dim)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--accent)'
              ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent)'
            }}
          >
            ☕ Traktir di Lynk.id
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>

          {/* Footer note */}
          <p style={{
            fontSize: 11, color: 'var(--silver3)', textAlign: 'center',
            lineHeight: 1.5, margin: 0,
          }}>
            Dukunganmu sangat berarti dan membantu<br/>
            pengembangan fitur-fitur baru JateamHub. 🙏
          </p>
        </div>
      </div>
    </div>
  )
}
