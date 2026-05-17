// ─────────────────────────────────────────────────────────────
// AVATAR CROP MODAL — Crop + zoom foto profil sebelum upload
// Pakai canvas — tidak butuh library eksternal
// CSP-safe: pakai data URL bukan blob URL
// ─────────────────────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  imageDataUrl: string   // data URL dari FileReader
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

export default function AvatarCropModal({ imageDataUrl, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // State crop
  const [scale, setScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [imgLoaded, setImgLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  const CROP_SIZE = 280  // ukuran canvas crop

  // Load gambar
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
      // Auto-fit gambar ke canvas
      const ratio = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height)
      setScale(ratio)
      setOffsetX(0); setOffsetY(0)
    }
    img.src = imageDataUrl
  }, [imageDataUrl])

  // Render ke canvas setiap state berubah
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imgLoaded) return
    const ctx = canvas.getContext('2d')!
    const cx = CROP_SIZE / 2
    const cy = CROP_SIZE / 2
    const r = CROP_SIZE / 2 - 4

    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE)

    // 1. Gambar semua image (full canvas, tanpa clip) sebagai layer bawah
    const w = img.width * scale
    const h = img.height * scale
    const dx = (CROP_SIZE - w) / 2 + offsetX
    const dy = (CROP_SIZE - h) / 2 + offsetY
    ctx.drawImage(img, dx, dy, w, h)

    // 2. Overlay gelap di LUAR lingkaran — pakai evenodd fill rule
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.beginPath()
    // Persegi besar (luar)
    ctx.rect(0, 0, CROP_SIZE, CROP_SIZE)
    // Lingkaran dalam (arah berlawanan → evenodd akan exclude lingkaran)
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true)
    ctx.fill('evenodd')
    ctx.restore()

    // 3. Border lingkaran
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    // 4. Update preview — gambar langsung dari image asli (bukan dari canvas display)
    const preview = previewRef.current
    if (preview) {
      const pCtx = preview.getContext('2d')!
      pCtx.clearRect(0, 0, 80, 80)
      pCtx.save()
      pCtx.beginPath()
      pCtx.arc(40, 40, 40, 0, Math.PI * 2)
      pCtx.clip()
      // Scale posisi dari CROP_SIZE ke 80px
      const ratio = 80 / CROP_SIZE
      pCtx.drawImage(img, dx * ratio, dy * ratio, w * ratio, h * ratio)
      pCtx.restore()
    }
  }, [scale, offsetX, offsetY, imgLoaded])

  useEffect(() => { draw() }, [draw])

  // Mouse drag
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true)
    setStartPos({ x: e.clientX - offsetX, y: e.clientY - offsetY })
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setOffsetX(e.clientX - startPos.x)
    setOffsetY(e.clientY - startPos.y)
  }
  const onMouseUp = () => setDragging(false)

  // Touch drag
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    setDragging(true)
    setStartPos({ x: e.touches[0].clientX - offsetX, y: e.touches[0].clientY - offsetY })
  }
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (!dragging) return
    setOffsetX(e.touches[0].clientX - startPos.x)
    setOffsetY(e.touches[0].clientY - startPos.y)
  }

  // Konfirmasi — export langsung dari image asli (bukan canvas display yang ada overlay)
  const handleConfirm = async () => {
    setSaving(true)
    const img = imgRef.current!
    const output = document.createElement('canvas')
    output.width = 400; output.height = 400
    const ctx = output.getContext('2d')!

    // Clip lingkaran dulu
    ctx.beginPath()
    ctx.arc(200, 200, 200, 0, Math.PI * 2)
    ctx.clip()

    // Gambar image asli dengan scale + offset yang sama seperti di preview
    const w = img.width * scale
    const h = img.height * scale
    // Hitung posisi di output canvas (scale dari CROP_SIZE ke 400)
    const ratio = 400 / CROP_SIZE
    const dx = ((CROP_SIZE - w) / 2 + offsetX) * ratio
    const dy = ((CROP_SIZE - h) / 2 + offsetY) * ratio
    ctx.drawImage(img, dx, dy, w * ratio, h * ratio)

    output.toBlob(blob => {
      setSaving(false)
      if (blob) onConfirm(blob)
    }, 'image/webp', 0.9)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, flexDirection: 'column', gap: 20,
    }}>
      <div style={{
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        borderRadius: 16, padding: '24px', maxWidth: 380, width: '100%',
        boxShadow: 'var(--shadow-lg)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--silver)', marginBottom: 16 }}>
          Sesuaikan Foto Profil
        </div>

        {/* Canvas crop */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <canvas
            ref={canvasRef}
            width={CROP_SIZE} height={CROP_SIZE}
            style={{
              borderRadius: '50%', cursor: dragging ? 'grabbing' : 'grab',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              touchAction: 'none',
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={() => setDragging(false)}
          />
        </div>

        {/* Zoom slider */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--silver3)', marginBottom: 6, fontFamily: 'var(--mono)' }}>
            ZOOM: {Math.round(scale * 100)}%
          </div>
          <input
            type="range" min={0.5} max={4} step={0.05}
            value={scale}
            onChange={e => setScale(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
        </div>

        {/* Preview kecil */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--silver3)' }}>Preview:</div>
          <canvas
            ref={previewRef} width={80} height={80}
            style={{ borderRadius: '50%', border: '2px solid var(--accent)' }}
          />
        </div>

        {/* Tip */}
        <div style={{ fontSize: 11, color: 'var(--silver3)', marginBottom: 16, lineHeight: 1.5 }}>
          Drag untuk geser · Scroll untuk zoom
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '10px', background: 'var(--bg2)',
            border: '1px solid var(--border2)', borderRadius: 8,
            color: 'var(--silver3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)',
          }}>Batal</button>
          <button onClick={handleConfirm} disabled={saving || !imgLoaded} style={{
            flex: 2, padding: '10px', background: 'var(--accent)',
            border: 'none', borderRadius: 8,
            color: 'white', fontSize: 13, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
            opacity: saving ? 0.7 : 1,
          }}>{saving ? 'Menyimpan...' : '✓ Simpan Foto'}</button>
        </div>
      </div>
    </div>
  )
}
