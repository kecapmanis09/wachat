import { useEffect, useState } from 'react'
import Login from './Login'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import ChatWindow from './ChatWindow'

export default function App() {
  const [user, setUser] = useState(null)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [ready, setReady] = useState(false)

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

  if (!ready) return null

  if (!user) {
    return <Login onLogin={setUser} />
  }

  return (
    <div className="app-shell">
      <Navbar user={user} onLogout={handleLogout} />
      <div className={`app-body ${selectedConversation ? 'has-conversation' : ''}`}>
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
      </div>
    </div>
  )
}
