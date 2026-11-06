import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false, // só entra quem já existe no Supabase
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="page login">
      <h1>Knowledge OS</h1>
      {sent ? (
        <p className="muted">
          Enviámos um link para <b>{email}</b>. Abre o email neste dispositivo e clica no link para entrar.
        </p>
      ) : (
        <form onSubmit={submit} className="stack">
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <button className="primary" disabled={busy}>{busy ? 'A enviar…' : 'Enviar link de entrada'}</button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  )
}
