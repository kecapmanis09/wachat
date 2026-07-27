import { useState } from 'react'
import { supabase } from './supabase'

export default function Login({ onLogin }) {
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
      // Cek apakah username sudah ada
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
