import { useState, useEffect } from 'react'
import { useStore } from './store/dashboardStore'
import LoginPage from './components/layout/LoginPage'
import Header from './components/layout/Header'
import OptionsPanel from './components/layout/OptionsPanel'
import EditBar from './components/layout/EditBar'
import GridLayout from './components/layout/GridLayout'
import SupportPage from './components/layout/SupportPage'
import ConfigModal from './components/ui/ConfigModal'
import PageInfoModal from './components/ui/PageInfoModal'
import UserManagementModal from './components/ui/UserManagementModal'
import ToastContainer from './components/ui/Toast'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

export default function App() {
  const { session, initSession, editMode, currentPage } = useStore()
  const [optionsOpen,  setOptionsOpen]  = useState(false)
  const [configOpen,   setConfigOpen]   = useState(false)
  const [pageInfoOpen, setPageInfoOpen] = useState(false)
  const [usersOpen,    setUsersOpen]    = useState(false)

  useEffect(() => { initSession() }, [])

  if (!session) return <LoginPage />

  const isSupport = currentPage === 'support'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        onToggleOptions={() => setOptionsOpen(v => !v)}
        optionsOpen={optionsOpen}
        onOpenConfig={() => setConfigOpen(true)}
      />

      {editMode && <div className="edit-mode-bar" />}

      <OptionsPanel
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        onOpenConfig={() => setConfigOpen(true)}
        onOpenUsers={() => setUsersOpen(true)}
      />

      <main className={`main${editMode && !isSupport ? ' edit-active' : ''}`} style={{ flex: 1 }}>
        {isSupport ? <SupportPage /> : <GridLayout />}
      </main>

      {/* Edit bar hanya muncul di halaman non-support */}
      {!isSupport && <EditBar onOpenPageInfo={() => setPageInfoOpen(true)} />}

      <ConfigModal         open={configOpen}   onClose={() => setConfigOpen(false)} />
      <PageInfoModal       open={pageInfoOpen} onClose={() => setPageInfoOpen(false)} />
      <UserManagementModal open={usersOpen}    onClose={() => setUsersOpen(false)} />
      <ToastContainer />
    </div>
  )
}
