import { useEffect, useState } from 'react'
import Login from './Login'
import Navbar from './Navbar'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import ChatWindow from './ChatWindow'

const TABS = [
  { id: 'chats', label: 'Chat', icon: '💬' },
  { id: 'updates', label: 'Update', icon: '🔄' },
  { id: 'communities', label: 'Komunitas', icon: '👥' },
  { id: 'calls', label: 'Panggilan', icon: '📞' },
  { id: 'settings', label: 'Setelan', icon: '⚙️' },
]

export default function App() {
  const [user, setUser] = useState(null)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [ready, setReady] = useState(false)
  const [activeTab, setActiveTab] = useState('chats')

  useEffect(() => {
    const saved = localStorage.getItem('wa_chat_user')
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch {
        localStorage.removeItem('wa_chat_user')
      }
    }
    setReady(true)
  }, [])

  function handleLogout() {
    localStorage.removeItem('wa_chat_user')
    setUser(null)
    setSelectedConversation(null)
  }

  function handleTabChange(tabId) {
    setActiveTab(tabId)
    if (tabId !== 'chats') {
      setSelectedConversation(null)
    }
  }

  if (!ready) return null

  if (!user) {
    return <Login onLogin={setUser} />
  }

  const activeTabInfo = TABS.find((t) => t.id === activeTab)

  return (
    <div className="app-shell">
      <Navbar title={activeTabInfo.label} />

      <div className={`app-body ${selectedConversation ? 'has-conversation' : ''}`}>
        {activeTab === 'chats' && (
          <>
            <Sidebar
              currentUser={user}
              selectedConversation={selectedConversation}
              onSelectConversation={setSelectedConversation}
            />
            <ChatWindow currentUser={user} conversation={selectedConversation} />
            {selectedConversation && (
              <button className="mobile-back" onClick={() => setSelectedConversation(null)}>
                ← Kembali
              </button>
            )}
          </>
        )}

        {activeTab === 'updates' && (
          <div className="placeholder-screen">
            <div className="placeholder-icon">🔄</div>
            <h2>Update</h2>
            <p>Fitur status/update akan segera hadir.</p>
          </div>
        )}

        {activeTab === 'communities' && (
          <div className="placeholder-screen">
            <div className="placeholder-icon">👥</div>
            <h2>Komunitas</h2>
            <p>Fitur komunitas akan segera hadir.</p>
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="placeholder-screen">
            <div className="placeholder-icon">📞</div>
            <h2>Panggilan</h2>
            <p>Riwayat panggilan akan segera hadir.</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-screen">
            <div className="settings-avatar">{user.username[0].toUpperCase()}</div>
            <div className="settings-username">@{user.username}</div>
            <button className="settings-logout" onClick={handleLogout}>
              Keluar
            </button>
          </div>
        )}
      </div>

      <BottomNav
        tabs={TABS}
        activeTab={activeTab}
        onChange={handleTabChange}
        hideOnMobile={activeTab === 'chats' && !!selectedConversation}
      />
    </div>
  )
}
