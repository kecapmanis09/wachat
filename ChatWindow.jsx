import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export default function ChatWindow({ currentUser, conversation }) {
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
