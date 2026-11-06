import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configOk, supabase } from './lib/supabase'
import Login from './pages/Login'
import Shell from './pages/Shell'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!configOk) {
    return (
      <div className="page">
        <p className="error">Falta o ficheiro .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ver README).</p>
      </div>
    )
  }
  if (!ready) return <div className="page muted">A carregar…</div>
  if (!session) return <Login />
  return <Shell email={session.user.email ?? ''} />
}
