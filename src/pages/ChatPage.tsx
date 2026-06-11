import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import ConversationList from '../components/chat/ConversationList'
import MessageThread from '../components/chat/MessageThread'
import ChatLockScreen from '../components/chat/ChatLockScreen'
import NewConversationModal from '../components/chat/NewConversationModal'

interface Props { onClose: () => void }

export default function ChatPage({ onClose }: Props) {
  const { profile } = useAuthStore()
  const {
    enabled, isLocked, conversations, currentConvId,
    loadConversations, selectConv, lock,
  } = useChatStore()
  const [newChatOpen,  setNewChatOpen]  = useState(false)
  const [mobileThread, setMobileThread] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  // Reactive isMobile
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeUp 180ms ease',
    }}>
      {/* Page header */}
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

        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--silver)', flex: 1, letterSpacing: '-0.3px' }}>
          {isMobile && mobileThread && currentConv
            ? (() => {
                const other = currentConv.participant_a === profile.id
                  ? currentConv.profile_b
                  : currentConv.profile_a
                return other?.full_name ?? other?.username ?? 'Chat'
              })()
            : '💬 Chat'
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
            />
          ) : currentConv ? (
            <MessageThread conv={currentConv} currentUserId={profile.id} />
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
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--silver4)', fontSize: 14, textAlign: 'center', padding: 24,
            }}>
              <div>
                <div style={{ fontSize: 40, marginBottom: 14 }}>💬</div>
                Pilih percakapan untuk membaca pesan.
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
    </div>
  )
}
