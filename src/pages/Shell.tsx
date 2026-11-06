import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Inbox from './Inbox'
import Review from './Review'

type Tab = 'inbox' | 'review'

export default function Shell({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('inbox')
  const [counts, setCounts] = useState<{ inbox?: number; review?: number }>({})

  // Contagens iniciais dos dois separadores (cada página atualiza a sua ao carregar)
  useEffect(() => {
    const endOfToday = new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
    Promise.all([
      supabase.from('items').select('id', { count: 'exact', head: true }).eq('classification_status', 'PendingValidation'),
      supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .lte('next_review_at', endOfToday)
        .not('status', 'in', '(Completed,Archived)')
        .neq('classification_status', 'Ignored'),
    ]).then(([a, b]) => setCounts({ inbox: a.count ?? 0, review: b.count ?? 0 }))
  }, [])

  // Funções estáveis (não mudam a cada render), para as páginas não recarregarem em ciclo
  const setInboxCount = useCallback((n: number) => setCounts((c) => (c.inbox === n ? c : { ...c, inbox: n })), [])
  const setReviewCount = useCallback((n: number) => setCounts((c) => (c.review === n ? c : { ...c, review: n })), [])

  const badge = (n?: number) => (n ? <span className="count">{n}</span> : null)

  return (
    <div className="page">
      <header className="top">
        <h1>Knowledge OS</h1>
        <button className="ghost" title={email} onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>

      <nav className="tabs">
        <button className={tab === 'inbox' ? 'active' : ''} onClick={() => setTab('inbox')}>
          Inbox {badge(counts.inbox)}
        </button>
        <button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}>
          Para rever {badge(counts.review)}
        </button>
      </nav>

      {tab === 'inbox' ? (
        <Inbox onCount={setInboxCount} />
      ) : (
        <Review onCount={setReviewCount} />
      )}
    </div>
  )
}
