import { useState, useMemo, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useChatStore } from '../../store/chatStore'
import { useT } from '../../utils/i18n'
import type { Profile } from '../../utils/supabaseClient'

interface Props {
  onClose:   () => void
  onStarted: (convId: string) => void
}

export default function NewConversationModal({ onClose, onStarted }: Props) {
  const t = useT()
  const { profile, users, loadUsers } = useAuthStore()
  const { startConv } = useChatStore()
  const [query,    setQuery]    = useState('')
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState('')
  const [usersLoading, setUsersLoading] = useState(false)

  useEffect(() => {
    if (!users.length) {
      setUsersLoading(true)
      loadUsers().finally(() => setUsersLoading(false))
    }
  }, [])

  const eligible = useMemo(() =>
    users.filter(u =>
      u.id !== profile?.id &&
      (u.full_name?.toLowerCase().includes(query.toLowerCase()) ||
       u.username?.toLowerCase().includes(query.toLowerCase()))
    )
  , [users, query, profile?.id])

  const handleSelect = async (target: Profile) => {
    if (!profile) return
    setBusy(true); setErr('')
    const conv = await startConv(profile.id, target.id)
    setBusy(false)
    if (!conv) { setErr('Gagal membuat percakapan. Coba lagi.'); return }
    onStarted(conv.id)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: '100%', maxWidth: 420, maxHeight: '80vh',
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 18, display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)', animation: 'fadeUp 180ms ease',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--silver)' }}>{t('chat.new')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--silver3)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '12px 16px' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('chat.searchuser')}
            autoFocus
            style={{
              width: '100%', height: 38, padding: '0 12px', boxSizing: 'border-box',
              background: 'var(--bg4)', border: '1px solid var(--border2)',
              borderRadius: 8, fontSize: 13, color: 'var(--silver)',
              fontFamily: 'var(--font)', outline: 'none',
            }}
          />
        </div>

        {err && (
          <div style={{ padding: '0 16px 8px', color: 'var(--red)', fontSize: 12 }}>{err}</div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
          {usersLoading && (
            <div style={{ textAlign: 'center', color: 'var(--silver4)', fontSize: 13, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ width: 14, height: 14, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
              Memuat daftar user...
            </div>
          )}
          {!usersLoading && eligible.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--silver4)', fontSize: 13, padding: 24 }}>
              {query ? 'Tidak ada hasil.' : 'Tidak ada user tersedia.'}
            </div>
          )}
          {eligible.map(u => (
            <button
              key={u.id}
              disabled={busy}
              onClick={() => handleSelect(u)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', border: 'none', borderRadius: 10,
                background: 'none', cursor: busy ? 'wait' : 'pointer',
                transition: 'background 100ms', textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-light)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: u.avatar_emoji || u.emoji ? 16 : 13,
                fontWeight: 700, color: 'var(--accent)',
              }}>
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : u.avatar_emoji || u.emoji
                  ? <span>{u.avatar_emoji || u.emoji}</span>
                  : <span>{(u.full_name?.[0] ?? '?').toUpperCase()}</span>
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--silver)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.full_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--silver4)' }}>
                  @{u.username} · {u.unit_scope}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
