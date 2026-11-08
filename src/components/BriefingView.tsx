import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate, fmtEvent } from '../lib/format'
import { ITEM_STATUSES, ITEM_TYPES, PERSON_TYPES } from '../lib/types'

type Participant = {
  id: string
  name: string
  type: string
  via: 'direct' | 'group'
  position: string | null
  restrictions: string | null
  health_recent: number
  recent: { id: string; title: string; type: string; category: string | null; status: string; created_at: string }[]
}

type Briefing = {
  event: { id: string; title: string; type: string; start_at: string; end_at: string | null; all_day: boolean; location: string | null; status: string }
  groups: string[]
  participants: Participant[]
  items: { id: string; title: string; type: string; status: string; due_at: string | null; link: 'direct' | 'scope'; description: string | null }[]
  goals: { id: string; title: string; status: string }[]
  pending_validation: number
}

// Briefing de Evento (nota 25): o que preciso de saber para este evento?
export default function BriefingView({ eventId }: { eventId: string }) {
  const [data, setData] = useState<Briefing | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('event_briefing_data', { p_event_id: eventId }).then(({ data, error }) => {
      if (error) setError(error.message)
      else setData(data as Briefing)
    })
  }, [eventId])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted small">A preparar o briefing…</p>

  const alerts = data.participants.filter((p) => p.restrictions || p.health_recent >= 2)
  const withNews = data.participants.filter((p) => p.recent.length > 0)
  const quiet = data.participants.filter((p) => p.recent.length === 0)

  return (
    <article className="card briefing">
      <header>
        <h3>📋 {data.event.title}</h3>
        <p className="muted small">
          {fmtEvent(data.event)}
          {data.event.location ? ` · 📍 ${data.event.location}` : ''}
          {data.groups.length ? ` · ${data.groups.join(', ')}` : ''}
          {data.event.status === 'Cancelled' ? ' · CANCELADO' : ''}
        </p>
      </header>

      {alerts.length > 0 && (
        <section className="b-section alert">
          <h4>⚠️ Alertas</h4>
          {alerts.map((p) => (
            <div key={p.id} className="small">
              <b>{p.name}</b>
              {p.restrictions ? ` — restrições: ${p.restrictions}` : ''}
              {p.health_recent >= 2 ? ` — ${p.health_recent} registos de saúde nos últimos 10 dias` : ''}
            </div>
          ))}
        </section>
      )}

      {data.goals.length > 0 && (
        <section className="b-section">
          <h4>🎯 Objetivos ativos</h4>
          {data.goals.map((g) => <div key={g.id} className="small">• {g.title}</div>)}
        </section>
      )}

      <section className="b-section">
        <h4>📝 Pontos para este evento</h4>
        {data.items.length === 0 && <div className="muted small">Nada ligado a este evento.</div>}
        {data.items.map((i) => (
          <div key={i.id} className="small">
            <span className={`badge type-${i.type}`}>{ITEM_TYPES[i.type] ?? i.type}</span> {i.title}
            <span className="muted">
              {i.link === 'scope' ? ' · regra' : ''}
              {i.status !== 'Open' ? ` · ${ITEM_STATUSES[i.status] ?? i.status}` : ''}
              {i.due_at ? ` · prazo ${fmtDate(i.due_at)}` : ''}
            </span>
          </div>
        ))}
      </section>

      <section className="b-section">
        <h4>👥 Quem participa ({data.participants.length})</h4>
        {data.participants.length === 0 && (
          <div className="muted small">Sem participantes registados. Diz no WhatsApp, por exemplo, "o Luke vem ao treino".</div>
        )}
        {withNews.map((p) => (
          <div key={p.id} className="b-person">
            <div className="small">
              <b>{p.name}</b> <span className="muted">{PERSON_TYPES[p.type] ?? p.type}{p.position ? ` · ${p.position}` : ''}</span>
            </div>
            {p.recent.map((r) => (
              <div key={r.id} className="small muted">• {r.title} ({fmtDate(r.created_at)})</div>
            ))}
          </div>
        ))}
        {quiet.length > 0 && (
          <div className="small muted" style={{ marginTop: 6 }}>
            Sem registos recentes: {quiet.map((p) => p.name).join(', ')}
          </div>
        )}
      </section>

      {data.pending_validation > 0 && (
        <p className="small muted">Tens {data.pending_validation} {data.pending_validation === 1 ? 'item' : 'itens'} por validar na Inbox.</p>
      )}
    </article>
  )
}
