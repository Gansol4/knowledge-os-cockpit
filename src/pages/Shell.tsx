import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Inbox from './Inbox'
import Review from './Review'
import Items from './Items'
import People from './People'
import Agenda from './Agenda'

type Tab = 'agenda' | 'inbox' | 'review' | 'items' | 'people'

export default function Shell({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('inbox')
  const [counts, setCounts] = useState<{ inbox?: number; review?: number; alerts?: number }>({})

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
      supabase.from('alerts').select('id', { count: 'exact', head: true }).in('status', ['new', 'sent', 'seen']),
    ]).then(([a, b, c]) => setCounts({ inbox: a.count ?? 0, review: b.count ?? 0, alerts: c.count ?? 0 }))
  }, [])

  // Funções estáveis (não mudam a cada render), para as páginas não recarregarem em ciclo
  const setInboxCount = useCallback((n: number) => setCounts((c) => (c.inbox === n ? c : { ...c, inbox: n })), [])
  const setReviewCount = useCallback((n: number) => setCounts((c) => (c.review === n ? c : { ...c, review: n })), [])
  const setAlertCount = useCallback((n: number) => setCounts((c) => (c.alerts === n ? c : { ...c, alerts: n })), [])

  const badge = (n?: number) => (n ? <span className="count">{n}</span> : null)

  return (
    <div className="page">
      <header className="top">
        <h1>Knowledge OS</h1>
        <button className="ghost" title={email} onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>

      <nav className="tabs">
        <button className={tab === 'agenda' ? 'active' : ''} onClick={() => setTab('agenda')}>
          Agenda {badge(counts.alerts)}
        </button>
        <button className={tab === 'inbox' ? 'active' : ''} onClick={() => setTab('inbox')}>
          Inbox {badge(counts.inbox)}
        </button>
        <button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}>
          Para rever {badge(counts.review)}
        </button>
        <button className={tab === 'items' ? 'active' : ''} onClick={() => setTab('items')}>
          Itens
        </button>
        <button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>
          Pessoas
        </button>
      </nav>

      {tab === 'inbox' && <Inbox onCount={setInboxCount} />}
      {tab === 'review' && <Review onCount={setReviewCount} />}
      {tab === 'items' && <Items />}
      {tab === 'people' && <People />}
      {tab === 'agenda' && <Agenda onAlerts={setAlertCount} />}
    </div>
  )
}
