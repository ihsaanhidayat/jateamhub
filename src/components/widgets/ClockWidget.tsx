import { useState, useEffect } from 'react'

const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

export default function ClockWidget() {
  const [now, setNow]       = useState(new Date())
  const [is24h, setIs24h]   = useState(true)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const h = is24h ? now.getHours() : now.getHours() % 12 || 12
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM'

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '12px 16px', userSelect: 'none',
      background: 'var(--bg2)',
    }}>
      {/* Time */}
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 'clamp(24px, 5vw, 48px)',
        fontWeight: 700,
        color: 'var(--mint)',
        letterSpacing: '-1px',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
      }}>
        <span>{String(h).padStart(2,'0')}</span>
        <span style={{ opacity: now.getSeconds() % 2 === 0 ? 1 : .3, transition: 'opacity .1s' }}>:</span>
        <span>{m}</span>
        <span style={{ opacity: now.getSeconds() % 2 === 0 ? 1 : .3, transition: 'opacity .1s' }}>:</span>
        <span>{s}</span>
        {!is24h && <span style={{ fontSize: '0.45em', color: 'var(--silver3)', marginLeft: 6 }}>{ampm}</span>}
      </div>

      {/* Date */}
      <div style={{
        fontSize: 12, color: 'var(--silver2)', marginTop: 6, fontWeight: 500,
      }}>
        {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()}
      </div>

      {/* Toggle 12/24h */}
      <button
        onClick={() => setIs24h(v => !v)}
        style={{
          marginTop: 10, background: 'var(--bg3)',
          border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
          color: 'var(--silver3)', fontSize: 10, padding: '2px 8px',
          cursor: 'pointer', fontFamily: 'var(--mono)',
          transition: 'all .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--mint)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
      >
        {is24h ? '24H' : '12H'}
      </button>
    </div>
  )
}
