import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useT } from '../utils/i18n'
import { ensureNotifyPermission, primeAudio } from '../utils/notify'
import { registerPushSubscription } from '../utils/push'
import ConversationList from '../components/chat/ConversationList'
import MessageThread from '../components/chat/MessageThread'
import ChatLockScreen from '../components/chat/ChatLockScreen'
import NewConversationModal from '../components/chat/NewConversationModal'
import ForwardModal from '../components/chat/ForwardModal'

interface Props { onClose: () => void }

export default function ChatPage({ onClose }: Props) {
  const t = useT()
  const { profile } = useAuthStore()
  const enabled           = useChatStore(s => s.enabled)
  const isLocked          = useChatStore(s => s.isLocked)
  const conversations     = useChatStore(s => s.conversations)
  const currentConvId     = useChatStore(s => s.currentConvId)
  const loadConversations = useChatStore(s => s.loadConversations)
  const selectConv        = useChatStore(s => s.selectConv)
  const closeConvChannel  = useChatStore(s => s.closeConvChannel)
  const lock              = useChatStore(s => s.lock)
  const resetIdle         = useChatStore(s => s.resetIdle)
  const [newChatOpen,  setNewChatOpen]  = useState(false)
  const [mobileThread, setMobileThread] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const rootRef = useRef<HTMLDivElement>(null)

  // Reactive isMobile
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Size the shell to the *visible* viewport (VisualViewport API).
  // Fixes the composer hiding behind mobile browser chrome / keyboard, and
  // keeps the scroll area exactly the visible height so scrolling works.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const vv = window.visualViewport
    let raf = 0, lastH = -1, lastTop = -1
    // Batch via rAF and only write when the value actually changed, so
    // scroll-driven viewport events don't thrash layout every frame.
    const apply = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const node = rootRef.current
        if (!node) return
        const h   = Math.round(vv?.height ?? window.innerHeight)
        const top = Math.round(vv?.offsetTop ?? 0)
        if (h !== lastH)   { node.style.height = `${h}px`; lastH = h }
        if (top !== lastTop) { node.style.top = `${top}px`; lastTop = top }
      })
    }
    apply()
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
    }
  }, [enabled])   // re-run once the real shell mounts (enabled: null → value)

  // Cleanup per-conversation broadcast channel on unmount
  useEffect(() => () => { closeConvChannel() }, [])

  // On unlock: unlock audio (gesture-gated) + ask for notification permission,
  // then register this device for closed-app Web Push.
  useEffect(() => {
    if (isLocked) return
    primeAudio()
    ensureNotifyPermission().then(ok => {
      if (ok && profile) registerPushSubscription(profile.id)
    })
  }, [isLocked, profile?.id])

  // Load conversations when unlocked
  useEffect(() => {
    if (!profile || isLocked) return
    loadConversations(profile.id)
  }, [profile?.id, isLocked])

  // Access gate: close if chat disabled after page opened
  const canAccess = enabled !== false &&
    (profile?.role === 'superadmin' || profile?.chat_enabled === true)

  useEffect(() => {
    if (enabled !== null && !canAccess) onClose()
  }, [enabled, canAccess])

  const currentConv = conversations.find(c => c.id === currentConvId)

  const handleSelectConv = async (id: string) => {
    if (!profile) return
    await selectConv(id, profile.id)
    setMobileThread(true)
  }

  const handleBack = () => {
    if (profile) selectConv(null, profile.id)
    setMobileThread(false)
  }

  if (!profile) return null
  // Show loading state while enabled is still being fetched
  if (enabled === null) return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120, background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ width: 28, height: 28, border: '3px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
    </div>
  )

  // On mobile inside a thread we show a single combined header (in MessageThread).
  const hidePageHeader = isMobile && mobileThread && !!currentConv && !isLocked

  return (
    <div
      ref={rootRef}
      className="chat-root"
      style={{
        zIndex: 120, background: 'var(--bg)',
        display: 'flex', flexDirection: 'column', minHeight: 0,
        animation: 'fadeUp 180ms ease',
      }}
      onPointerDown={resetIdle}
      onKeyDown={resetIdle}
    >
      {/* Page header */}
      {!hidePageHeader && (
      <div style={{
        height: 56, flexShrink: 0,
        background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8,
        zIndex: 1,
      }}>
        {isMobile && mobileThread ? (
          <button
            onClick={handleBack}
            style={{
              width: 34, height: 34, background: 'none', border: 'none',
              cursor: 'pointer', borderRadius: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        ) : (
          <button
            onClick={onClose}
            style={{
              width: 34, height: 34, background: 'none', border: 'none',
              cursor: 'pointer', borderRadius: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--silver3)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}

        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--silver)', flex: 1, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {isMobile && mobileThread && currentConv
            ? (() => {
                const other = currentConv.participant_a === profile.id
                  ? currentConv.profile_b
                  : currentConv.profile_a
                return <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{other?.full_name ?? other?.username ?? 'Chat'}</span>
              })()
            : <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Chat
              </>
          }
        </span>

        {!isLocked && (
          <button
            onClick={lock}
            title="Kunci Chat"
            style={{
              width: 34, height: 34, background: 'none', border: 'none',
              cursor: 'pointer', borderRadius: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--silver3)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </button>
        )}
      </div>
      )}

      {/* Body */}
      {isLocked ? (
        <ChatLockScreen />
      ) : isMobile ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {!mobileThread ? (
            <ConversationList
              currentUserId={profile.id}
              onNewChat={() => setNewChatOpen(true)}
              onSelectConv={handleSelectConv}
              mobile
            />
          ) : currentConv ? (
            <MessageThread conv={currentConv} currentUserId={profile.id} onBack={handleBack} />
          ) : null}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          <ConversationList
            currentUserId={profile.id}
            onNewChat={() => setNewChatOpen(true)}
            onSelectConv={handleSelectConv}
          />
          {currentConv ? (
            <MessageThread conv={currentConv} currentUserId={profile.id} />
          ) : (
            <div className="chat-wallpaper" style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: 24,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 280 }}>
                <div style={{
                  width: 84, height: 84, borderRadius: '50%',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 18px rgba(0,0,0,.06)',
                }}>
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--silver)' }}>{t('chat.team')}</div>
                <div style={{ fontSize: 13, color: 'var(--silver4)', lineHeight: 1.5 }}>
                  {t('chat.pick')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {newChatOpen && (
        <NewConversationModal
          onClose={() => setNewChatOpen(false)}
          onStarted={handleSelectConv}
        />
      )}

      <ForwardModal currentUserId={profile.id} />
    </div>
  )
}
