import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'

/* ============================================================
   Supabase client
   ============================================================ */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env'
  )
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

/* ============================================================
   Login
   ============================================================ */
function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const clean = username.trim().toLowerCase()
    if (!clean) return
    setLoading(true)
    setError('')

    try {
      const { data: existing, error: fetchError } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', clean)
        .maybeSingle()

      if (fetchError) throw fetchError

      let user = existing

      if (!user) {
        const { data: created, error: insertError } = await supabase
          .from('users')
          .insert({ username: clean })
          .select('id, username')
          .single()

        if (insertError) throw insertError
        user = created
      }

      localStorage.setItem('wa_chat_user', JSON.stringify(user))
      onLogin(user)
    } catch (err) {
      console.error(err)
      setError('Gagal masuk. Coba periksa koneksi Supabase kamu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">💬</div>
        <h1>ChatKu</h1>
        <p>Masukkan username untuk mulai chatting</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username kamu"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Memuat...' : 'Masuk'}
          </button>
        </form>
        {error && <p className="login-error">{error}</p>}
      </div>
    </div>
  )
}

/* ============================================================
   Navbar
   ============================================================ */
function Navbar({ title }) {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">💬</span>
        <span>{title || 'ChatKu'}</span>
      </div>
    </header>
  )
}

/* ============================================================
   BottomNav
   ============================================================ */
function BottomNav({ tabs, activeTab, onChange, hideOnMobile }) {
  return (
    <nav className={`bottom-nav ${hideOnMobile ? 'bottom-nav-hide-mobile' : ''}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span className="bottom-nav-icon">{tab.icon}</span>
          <span className="bottom-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

/* ============================================================
   Sidebar
   ============================================================ */
function Sidebar({ currentUser, selectedConversation, onSelectConversation }) {
  const [conversations, setConversations] = useState([])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  const loadConversations = useCallback(async () => {
    const { data: convos, error } = await supabase
      .from('conversations')
      .select('id, created_at, user1:user1_id(id, username), user2:user2_id(id, username)')
      .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    const ids = convos.map((c) => c.id)
    let lastMessages = {}

    if (ids.length > 0) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, content, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })

      if (msgs) {
        for (const m of msgs) {
          if (!lastMessages[m.conversation_id]) {
            lastMessages[m.conversation_id] = m
          }
        }
      }
    }

    const withPreview = convos
      .map((c) => {
        const other = c.user1.id === currentUser.id ? c.user2 : c.user1
        const last = lastMessages[c.id]
        return {
          id: c.id,
          other,
          lastMessage: last?.content ?? 'Belum ada pesan',
          lastAt: last?.created_at ?? c.created_at,
        }
      })
      .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))

    setConversations(withPreview)
  }, [currentUser.id])

  useEffect(() => {
    loadConversations()

    const channel = supabase
      .channel('sidebar-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => loadConversations()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadConversations])

  useEffect(() => {
    const clean = search.trim().toLowerCase()
    if (!clean) {
      setResults([])
      return
    }
    setSearching(true)
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('users')
        .select('id, username')
        .ilike('username', `%${clean}%`)
        .neq('id', currentUser.id)
        .limit(6)
      setResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search, currentUser.id])

  async function startConversation(otherUser) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(user1_id.eq.${currentUser.id},user2_id.eq.${otherUser.id}),and(user1_id.eq.${otherUser.id},user2_id.eq.${currentUser.id})`
      )
      .maybeSingle()

    let conversationId = existing?.id

    if (!conversationId) {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ user1_id: currentUser.id, user2_id: otherUser.id })
        .select('id')
        .single()
      if (error) {
        console.error(error)
        return
      }
      conversationId = created.id
    }

    setSearch('')
    setResults([])
    await loadConversations()
    onSelectConversation({ id: conversationId, other: otherUser })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Cari username untuk mulai chat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {search && (
        <div className="search-results">
          {searching && <div className="search-hint">Mencari...</div>}
          {!searching && results.length === 0 && (
            <div className="search-hint">Tidak ada user ditemukan</div>
          )}
          {results.map((u) => (
            <div key={u.id} className="search-result-item" onClick={() => startConversation(u)}>
              <div className="avatar">{u.username[0].toUpperCase()}</div>
              <div>@{u.username}</div>
            </div>
          ))}
        </div>
      )}

      <div className="conversation-list">
        {conversations.length === 0 && !search && (
          <div className="empty-list">
            Belum ada percakapan.<br />Cari username di atas untuk mulai chat.
          </div>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`conversation-item ${selectedConversation?.id === c.id ? 'active' : ''}`}
            onClick={() => onSelectConversation({ id: c.id, other: c.other })}
          >
            <div className="avatar">{c.other.username[0].toUpperCase()}</div>
            <div className="conversation-info">
              <div className="conversation-name">@{c.other.username}</div>
              <div className="conversation-preview">{c.lastMessage}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

/* ============================================================
   ChatWindow
   ============================================================ */
function ChatWindow({ currentUser, conversation }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!conversation) return

    let active = true

    async function loadMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })

      if (!error && active) setMessages(data || [])
    }

    loadMessages()

    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [conversation])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content || !conversation) return
    setText('')

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: currentUser.id,
      content,
    })

    if (error) console.error(error)
  }

  if (!conversation) {
    return (
      <div className="chat-window empty">
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <p>Pilih percakapan untuk mulai chatting</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="avatar">{conversation.other.username[0].toUpperCase()}</div>
        <div className="chat-header-name">@{conversation.other.username}</div>
      </div>

      <div className="chat-messages">
        {messages.map((m) => {
          const mine = m.sender_id === currentUser.id
          return (
            <div key={m.id} className={`bubble-row ${mine ? 'mine' : 'theirs'}`}>
              <div className={`bubble ${mine ? 'mine' : 'theirs'}`}>
                <div className="bubble-text">{m.content}</div>
                <div className="bubble-time">
                  {new Date(m.created_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Ketik pesan..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Kirim</button>
      </form>
    </div>
  )
}

/* ============================================================
   App
   ============================================================ */
const TABS = [
  { id: 'chats', label: 'Chat', icon: '💬' },
  { id: 'updates', label: 'Update', icon: '🔄' },
  { id: 'communities', label: 'Komunitas', icon: '👥' },
  { id: 'calls', label: 'Panggilan', icon: '📞' },
  { id: 'settings', label: 'Setelan', icon: '⚙️' },
]

function App() {
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

/* ============================================================
   Render
   ============================================================ */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
