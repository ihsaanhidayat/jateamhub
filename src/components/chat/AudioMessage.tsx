import { useRef, useState, useMemo } from 'react'

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// Deterministic faux-waveform bars seeded from the file URL (stable per message).
function seededBars(seed: string, n: number): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const out: number[] = []
  for (let i = 0; i < n; i++) { h = (h * 1103515245 + 12345) >>> 0; out.push(0.22 + (h % 1000) / 1000 * 0.78) }
  return out
}

export default function AudioMessage({ src, isMine }: { src: string; isMine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const bars = useMemo(() => seededBars(src, 34), [src])

  const fg = isMine ? 'white' : 'var(--accent)'
  const dim = isMine ? 'rgba(255,255,255,0.45)' : 'var(--border2)'

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) a.pause()
    else a.play().catch(() => {})
  }

  const onMeta = () => {
    const a = audioRef.current
    if (!a) return
    if (a.duration === Infinity || isNaN(a.duration)) {
      // WebM/MediaRecorder duration fix: seek far, then back.
      a.currentTime = 1e101
      a.ontimeupdate = () => { a.ontimeupdate = null; a.currentTime = 0; setDur(a.duration) }
    } else setDur(a.duration)
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (!a || !dur) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    a.currentTime = ratio * dur
  }

  const progress = dur ? cur / dur : 0
  const filled = Math.round(progress * bars.length)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px', minWidth: 200 }}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={onMeta}
        onDurationChange={() => { const a = audioRef.current; if (a && isFinite(a.duration)) setDur(a.duration) }}
        onTimeUpdate={() => setCur(audioRef.current?.currentTime ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCur(0) }}
      />
      <button
        onClick={toggle}
        style={{
          width: 36, height: 36, flexShrink: 0, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: isMine ? 'rgba(255,255,255,0.22)' : 'var(--accent-light)',
          color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {playing
          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
          : <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div onClick={seek} style={{ display: 'flex', alignItems: 'center', gap: 2, height: 26, cursor: 'pointer' }}>
          {bars.map((b, i) => (
            <span key={i} style={{
              flex: 1, height: `${Math.round(b * 100)}%`, minWidth: 2, borderRadius: 2,
              background: i < filled ? fg : dim, transition: 'background 80ms',
            }} />
          ))}
        </div>
        <div style={{ fontSize: 10.5, opacity: 0.8, marginTop: 1, fontFamily: 'var(--mono)' }}>
          {fmt(playing || cur ? cur : dur)}
        </div>
      </div>
    </div>
  )
}
