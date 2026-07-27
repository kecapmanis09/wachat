import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

export default function Sidebar({ currentUser, selectedConversation, onSelectConversation }) {
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
