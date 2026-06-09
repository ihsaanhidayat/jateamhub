import { useEffect, useId, useRef } from 'react'

interface Props {
  open:     boolean
  title:    string
  onClose:  () => void
  children: React.ReactNode
  footer?:  React.ReactNode
}

export default function Modal({ open, title, onClose, children, footer }: Props) {
  const titleId  = useId()
  const boxRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    // Focus first focusable element inside modal
    const t = setTimeout(() => {
      const el = boxRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      el?.focus()
    }, 50)
    return () => { document.removeEventListener('keydown', h); clearTimeout(t) }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-box" ref={boxRef}>
        <div className="modal-header">
          <span className="modal-title" id={titleId}>{title}</span>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
