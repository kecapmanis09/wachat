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
   Ripple: efek tap ala Material/Android untuk elemen interaktif.
   Pasang class="ripple" + onPointerDown={addRipple} pada elemen.
   ============================================================ */
function addRipple(e) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const size = Math.max(rect.width, rect.height) * 1.8
  const dot = document.createElement('span')
  dot.className = 'ripple-dot'
  dot.style.setProperty('--rx', `${x}px`)
  dot.style.setProperty('--ry', `${y}px`)
  dot.style.setProperty('--rd', `${size}px`)
  el.appendChild(dot)
  dot.addEventListener('animationend', () => dot.remove())
}

/* Ikon Material Symbols kecil supaya konsisten dipakai di mana-mana */
function Icon({ name, filled, className = '', style }) {
  return (
    <span className={`m-icon ${filled ? 'filled' : ''} ${className}`} style={style}>
      {name}
    </span>
  )
}

/* ============================================================
   PIN ala BBM: 8 karakter acak (angka + huruf), huruf/angka yang
   gampang ketuker (0/O, 1/I) sengaja tidak dipakai.
   ============================================================ */
function generatePin() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let pin = ''
  for (let i = 0; i < 8; i++) {
    pin += chars[Math.floor(Math.random() * chars.length)]
  }
  return pin
}

/* ============================================================
   Auth (Login / Daftar akun + reveal PIN)
   ============================================================ */
function Auth({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pinReveal, setPinReveal] = useState(null) // { pin, needsConfirmation }

  function switchMode(next) {
    setMode(next)
    setError('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInError) throw signInError

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, username, email, pin')
        .eq('id', data.user.id)
        .single()
      if (profileError) throw profileError

      onLogin(profile)
    } catch (err) {
      console.error(err)
      setError('Email atau password salah.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    const cleanUsername = username.trim().toLowerCase()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanUsername || !cleanEmail || !password) return
    setLoading(true)
    setError('')

    try {
      const { data: existingUsername } = await supabase
        .from('users')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle()

      if (existingUsername) {
        setError('Username sudah dipakai, coba yang lain.')
        setLoading(false)
        return
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      })
      if (signUpError) throw signUpError

      const authUser = signUpData.user
      if (!authUser) throw new Error('Pendaftaran gagal, coba lagi.')

      // Generate PIN unik, retry kalau tabrakan (unique violation kode 23505)
      let profile = null
      let lastError = null
      for (let attempt = 0; attempt < 5 && !profile; attempt++) {
        const pin = generatePin()
        const { data: created, error: insertError } = await supabase
          .from('users')
          .insert({ id: authUser.id, username: cleanUsername, email: cleanEmail, pin })
          .select('id, username, email, pin')
          .single()

        if (!insertError) {
          profile = created
        } else if (insertError.code !== '23505') {
          throw insertError
        } else {
          lastError = insertError
        }
      }
      if (!profile) throw lastError || new Error('Gagal membuat PIN, coba lagi.')

      setPinReveal({ profile, needsConfirmation: !signUpData.session })
    } catch (err) {
      console.error(err)
      let msg = 'Gagal daftar akun. Coba lagi.'
      if (err?.code === 'over_email_send_rate_limit' || err?.status === 429) {
        msg = 'Terlalu banyak percobaan daftar. Coba lagi beberapa menit lagi.'
      } else if (err?.message?.toLowerCase().includes('already registered')) {
        msg = 'Email sudah terdaftar. Coba login.'
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function copyPin(pin) {
    navigator.clipboard?.writeText(pin).catch(() => {})
  }

  if (pinReveal) {
    return (
      <div className="login-screen">
        <div className="login-card pin-reveal-card">
          <div className="login-logo">
            <Icon name="key" filled />
          </div>
          <h1>Akun berhasil dibuat!</h1>
          <p>
            Ini PIN kamu, seperti BBM — bagikan ke teman supaya mereka bisa nambahin kamu
            langsung tanpa cari username.
          </p>
          <div className="pin-display">
            {pinReveal.profile.pin.split('').map((c, i) => (
              <span key={i} className="pin-char">
                {c}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="pin-copy-btn ripple"
            onPointerDown={addRipple}
            onClick={() => copyPin(pinReveal.profile.pin)}
          >
            <Icon name="content_copy" /> Salin PIN
          </button>

          {pinReveal.needsConfirmation ? (
            <>
              <p className="pin-note">
                Cek email <strong>{pinReveal.profile.email}</strong> untuk konfirmasi akun dulu,
                baru bisa login. PIN kamu sudah tersimpan, aman.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  switchMode('login')
                  setPinReveal(null)
                }}
              >
                <button type="submit" className="ripple" onPointerDown={addRipple}>
                  Ke halaman login
                </button>
              </form>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                onLogin(pinReveal.profile)
              }}
            >
              <button type="submit" className="ripple" onPointerDown={addRipple}>
                Lanjut ke ChatKu
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="login-screen">
      <div
        className="status-bar-spacer"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'transparent' }}
      />
      <div className="login-card">
        <div className="login-logo">
          <Icon name="forum" filled />
        </div>
        <h1>ChatKu</h1>
        <p>{mode === 'login' ? 'Masuk untuk mulai chatting' : 'Buat akun baru untuk mulai chatting'}</p>

        <div className="auth-tabs">
          <span className="auth-tabs-indicator" style={{ transform: `translateX(${mode === 'login' ? 0 : 100}%)` }} />
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
            Masuk
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>
            Daftar
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
          {mode === 'register' && (
            <div className="field">
              <Icon name="person" />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <div className="field">
            <Icon name="mail" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={mode === 'login'}
            />
          </div>
          <div className="field">
            <Icon name="lock" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="ripple" onPointerDown={addRipple} disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? 'Memuat...' : mode === 'login' ? 'Masuk' : 'Daftar'}
          </button>
        </form>
      </div>
      {error && (
        <div className="snackbar">
          <Icon name="error" filled />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Navbar
   ============================================================ */
function Navbar({ title, showActions }) {
  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="navbar-logo">
          <Icon name="forum" filled />
        </span>
        <span>{title || 'ChatKu'}</span>
      </div>
      {showActions && (
        <div className="navbar-actions">
          <button
            className="navbar-action ripple"
            onPointerDown={addRipple}
            aria-label="Kamera"
            title="Kamera"
          >
            <Icon name="photo_camera" />
          </button>
          <button
            className="navbar-action ripple"
            onPointerDown={addRipple}
            aria-label="Menu lainnya"
            title="Menu lainnya"
          >
            <Icon name="more_vert" />
          </button>
        </div>
      )}
    </header>
  )
}

/* ============================================================
   BottomNav
   ============================================================ */
function BottomNav({ tabs, activeTab, onChange, hideOnMobile, badges }) {
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeTab))

  return (
    <nav className={`bottom-nav ${hideOnMobile ? 'bottom-nav-hide-mobile' : ''}`}>
      <div className="bottom-nav-inner">
        <span
          className="nav-indicator"
          style={{
            width: `${100 / tabs.length}%`,
            '--nav-x': `${activeIndex * 100}%`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
          key={activeTab}
        />
        {tabs.map((tab) => {
          const badgeCount = badges?.[tab.id]
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              className={`bottom-nav-item ripple ${active ? 'active' : ''}`}
              onPointerDown={addRipple}
              onClick={() => onChange(tab.id)}
              aria-label={tab.label}
            >
              <span className="bottom-nav-icon-wrap">
                <Icon name={tab.icon} filled={active} className="bottom-nav-icon" />
                {!!badgeCount && <span className="bottom-nav-badge">{badgeCount > 99 ? '99+' : badgeCount}</span>}
              </span>
              <span className="bottom-nav-label">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ============================================================
   Sidebar
   ============================================================ */
function Sidebar({ currentUser, selectedConversation, onSelectConversation, onConversationsChange }) {
  const [conversations, setConversations] = useState([])
  const [search, setSearch] = useState('')
  const [searchMode, setSearchMode] = useState('username') // 'username' | 'pin'
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const searchInputRef = useRef(null)

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
        .select('conversation_id, content, created_at, sender_id')
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
          lastMine: last ? last.sender_id === currentUser.id : false,
        }
      })
      .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))

    setConversations(withPreview)
    onConversationsChange?.(withPreview.length)
    setLoadingList(false)
  }, [currentUser.id, onConversationsChange])

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
    const clean = search.trim()
    if (!clean) {
      setResults([])
      return
    }
    setSearching(true)
    const timeout = setTimeout(async () => {
      const query = supabase.from('users').select('id, username, pin').neq('id', currentUser.id).limit(6)
      const { data } =
        searchMode === 'pin'
          ? await query.ilike('pin', `%${clean.toUpperCase()}%`)
          : await query.ilike('username', `%${clean.toLowerCase()}%`)
      setResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search, searchMode, currentUser.id])

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

  function formatListTime(iso) {
    const date = new Date(iso)
    const now = new Date()
    const sameDay = date.toDateString() === now.toDateString()
    if (sameDay) {
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return 'Kemarin'
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-search">
        <div className="search-mode-tabs">
          <button
            type="button"
            className={searchMode === 'username' ? 'active' : ''}
            onClick={() => setSearchMode('username')}
          >
            Username
          </button>
          <button
            type="button"
            className={searchMode === 'pin' ? 'active' : ''}
            onClick={() => setSearchMode('pin')}
          >
            Tambah pakai PIN
          </button>
        </div>
        <div className="sidebar-search-box">
          <Icon name="search" className="sidebar-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={searchMode === 'pin' ? 'Masukkan PIN teman (8 karakter)' : 'Cari atau mulai chat baru'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {search && (
        <div className="search-results">
          {searching && <div className="search-hint">Mencari...</div>}
          {!searching && results.length === 0 && (
            <div className="search-hint">
              <Icon name="search_off" /> Tidak ada user ditemukan
            </div>
          )}
          {results.map((u) => (
            <div
              key={u.id}
              className="search-result-item ripple"
              onPointerDown={addRipple}
              onClick={() => startConversation(u)}
            >
              <div className="avatar">{u.username[0].toUpperCase()}</div>
              <div>
                <div>@{u.username}</div>
                <div className="result-pin">PIN {u.pin}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="conversation-list">
        {loadingList &&
          Array.from({ length: 5 }).map((_, i) => (
            <div className="skeleton-item" key={i}>
              <div className="skeleton-avatar" />
              <div className="skeleton-lines">
                <div className="skeleton-line long" />
                <div className="skeleton-line short" />
              </div>
            </div>
          ))}

        {!loadingList && conversations.length === 0 && !search && (
          <div className="empty-list">
            <Icon name="forum" />
            <br />
            Belum ada percakapan.<br />Cari username di atas untuk mulai chat.
          </div>
        )}
        {!loadingList &&
          conversations.map((c) => (
            <div
              key={c.id}
              className={`conversation-item ripple ${selectedConversation?.id === c.id ? 'active' : ''}`}
              onPointerDown={addRipple}
              onClick={() => onSelectConversation({ id: c.id, other: c.other })}
            >
              <div className="avatar">{c.other.username[0].toUpperCase()}</div>
              <div className="conversation-info">
                <div className="conversation-info-top">
                  <div className="conversation-name">@{c.other.username}</div>
                  <div className="conversation-time">{formatListTime(c.lastAt)}</div>
                </div>
                <div className="conversation-preview">
                  {c.lastMine && (
                    <span className="conversation-tick">
                      <Icon name="done_all" style={{ fontSize: 15 }} />
                    </span>
                  )}
                  <span className="conversation-preview-text">{c.lastMessage}</span>
                </div>
              </div>
            </div>
          ))}
      </div>

      <button
        className="fab ripple"
        onPointerDown={addRipple}
        aria-label="Mulai chat baru"
        title="Mulai chat baru"
        onClick={() => searchInputRef.current?.focus()}
      >
        <Icon name="add_comment" filled />
      </button>
    </aside>
  )
}

/* ============================================================
   ChatWindow
   ============================================================ */
function ChatWindow({ currentUser, conversation, onBack }) {
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
          <div className="empty-icon">
            <Icon name="forum" />
          </div>
          <p>Pilih percakapan untuk mulai chatting</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <button className="chat-back ripple" onPointerDown={addRipple} onClick={onBack} aria-label="Kembali">
          <Icon name="arrow_back" />
        </button>
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
        <button type="submit" className="ripple" onPointerDown={addRipple} aria-label="Kirim">
          <Icon name="send" filled />
        </button>
      </form>
    </div>
  )
}

/* ============================================================
   App
   ============================================================ */
const TABS = [
  { id: 'chats', label: 'Chat', icon: 'chat' },
  { id: 'updates', label: 'Update', icon: 'autorenew' },
  { id: 'calls', label: 'Panggilan', icon: 'call' },
  { id: 'settings', label: 'Setelan', icon: 'settings' },
]

function App() {
  const [user, setUser] = useState(null)
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [ready, setReady] = useState(false)
  const [activeTab, setActiveTab] = useState('chats')
  const [conversationCount, setConversationCount] = useState(0)
  const [pinCopied, setPinCopied] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSessionProfile(session) {
      if (!session) {
        if (active) setUser(null)
        return
      }
      const { data: profile, error } = await supabase
        .from('users')
        .select('id, username, email, pin')
        .eq('id', session.user.id)
        .single()
      if (active) setUser(error ? null : profile)
    }

    supabase.auth.getSession().then(({ data }) => {
      loadSessionProfile(data.session).finally(() => {
        if (active) setReady(true)
      })
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadSessionProfile(session)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
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
    return <Auth onLogin={setUser} />
  }

  const activeTabInfo = TABS.find((t) => t.id === activeTab)

  return (
    <div className="app-shell">
      <div className="status-bar-spacer" />
      <Navbar title={activeTabInfo.label} showActions={activeTab === 'chats'} />

      <div className={`app-body ${selectedConversation ? 'has-conversation' : ''}`}>
        {activeTab === 'chats' && (
          <>
            <Sidebar
              currentUser={user}
              selectedConversation={selectedConversation}
              onSelectConversation={setSelectedConversation}
              onConversationsChange={setConversationCount}
            />
            <ChatWindow
              currentUser={user}
              conversation={selectedConversation}
              onBack={() => setSelectedConversation(null)}
            />
          </>
        )}

        {activeTab === 'updates' && (
          <div className="placeholder-screen screen-enter">
            <div className="placeholder-icon">
              <Icon name="autorenew" />
            </div>
            <h2>Update</h2>
            <p>Fitur status/update akan segera hadir.</p>
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="placeholder-screen screen-enter">
            <div className="placeholder-icon">
              <Icon name="call" />
            </div>
            <h2>Panggilan</h2>
            <p>Riwayat panggilan akan segera hadir.</p>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-screen screen-enter">
            <div className="settings-avatar">{user.username[0].toUpperCase()}</div>
            <div className="settings-username">@{user.username}</div>

            <div className="settings-card">
              <div className="settings-row">
                <Icon name="mail" />
                <span>{user.email}</span>
              </div>
              <div className="settings-row settings-pin-row">
                <Icon name="key" />
                <div className="settings-pin-info">
                  <span className="settings-pin-label">PIN kamu</span>
                  <span className="settings-pin-value">{user.pin}</span>
                </div>
                <button
                  className="settings-pin-copy ripple"
                  onPointerDown={addRipple}
                  onClick={() => {
                    navigator.clipboard?.writeText(user.pin).catch(() => {})
                    setPinCopied(true)
                    setTimeout(() => setPinCopied(false), 1600)
                  }}
                  aria-label="Salin PIN"
                >
                  <Icon name={pinCopied ? 'check' : 'content_copy'} />
                </button>
              </div>
            </div>

            <button className="settings-logout ripple" onPointerDown={addRipple} onClick={handleLogout}>
              <Icon name="logout" />
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
        badges={{ chats: conversationCount }}
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
