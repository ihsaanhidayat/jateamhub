import { useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useT } from '../../utils/i18n'

export default function ChatLockScreen() {
  const t = useT()
  const { hasPinSet, verifyAndUnlock, setupPin } = useChatStore()
  const [pin,     setPin]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [err,     setErr]     = useState('')
  const [busy,    setBusy]    = useState(false)
  const isSetup = !hasPinSet

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin || pin.length < 4) { setErr(t('chat.lock.min')); return }
    setBusy(true); setErr('')

    if (isSetup) {
      if (pin !== confirm) { setErr(t('chat.lock.mismatch')); setBusy(false); return }
      await setupPin(pin)
    } else {
      const ok = await verifyAndUnlock(pin)
      if (!ok) { setErr(t('chat.lock.wrong')); setBusy(false); setPin(''); return }
    }
    setBusy(false)
  }

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%', maxWidth: 320,
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 20, padding: '32px 28px',
        boxShadow: 'var(--shadow-lg)', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 22,
        }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--silver)', margin: '0 0 6px', letterSpacing: '-0.4px' }}>
          {isSetup ? t('chat.lock.setup') : t('chat.lock.locked')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--silver3)', margin: '0 0 24px' }}>
          {isSetup
            ? t('chat.lock.setupdesc')
            : t('chat.lock.unlockdesc')}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setErr('') }}
            placeholder={isSetup ? t('chat.lock.newpin') : t('chat.lock.enterpin')}
            autoFocus
            style={{
              width: '100%', height: 44, padding: '0 14px', boxSizing: 'border-box',
              background: 'var(--bg4)', border: '1px solid var(--border2)',
              borderRadius: 10, fontSize: 20, color: 'var(--silver)', textAlign: 'center',
              letterSpacing: 8, fontFamily: 'var(--mono)', outline: 'none',
            }}
          />
          {isSetup && (
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={confirm}
              onChange={e => { setConfirm(e.target.value.replace(/\D/g, '')); setErr('') }}
              placeholder={t('chat.lock.confirmpin')}
              style={{
                width: '100%', height: 44, padding: '0 14px', boxSizing: 'border-box',
                background: 'var(--bg4)', border: '1px solid var(--border2)',
                borderRadius: 10, fontSize: 20, color: 'var(--silver)', textAlign: 'center',
                letterSpacing: 8, fontFamily: 'var(--mono)', outline: 'none',
              }}
            />
          )}
          {err && (
            <div style={{
              padding: '8px 12px', background: 'var(--red-bg)',
              border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
              borderRadius: 8, color: 'var(--red)', fontSize: 12,
            }}>{err}</div>
          )}
          <button
            type="submit"
            disabled={busy}
            style={{
              height: 44, background: busy ? 'var(--border2)' : 'var(--accent)',
              border: 'none', borderRadius: 10, color: 'white',
              fontSize: 14, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'var(--font)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}
          >
            {busy
              ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> {t('chat.lock.verifying')}</>
              : isSetup ? t('chat.lock.createbtn') : t('chat.lock.openbtn')
            }
          </button>
        </form>
      </div>
    </div>
  )
}
