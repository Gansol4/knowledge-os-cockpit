import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { EVENT_TYPES } from '../lib/types'
import BriefingView from '../components/BriefingView'
import AlertsPanel from '../components/AlertsPanel'

type Ev = { id: string; title: string; start_at: string; end_at: string | null; all_day: boolean; event_type: string; status: string }

const dayHeader = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: '2-digit', month: '2-digit' })
const hour = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' })

// Agenda: alertas abertos no topo; próximos eventos; clicar num abre o briefing
export default function Agenda({ onAlerts }: { onAlerts?: (n: number) => void }) {
  const [events, setEvents] = useState<Ev[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [days, setDays] = useState(14)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start.getTime() + days * 86_400_000)
    const { data, error } = await supabase
      .from('events')
      .select('id, title, start_at, end_at, all_day, event_type, status')
      .gte('start_at', start.toISOString())
      .lt('start_at', end.toISOString())
      .neq('status', 'Cancelled')
      .order('start_at')
    if (error) setError(error.message)
    else setEvents((data ?? []) as Ev[])
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  const byDay = useMemo(() => {
    const groups: { day: string; events: Ev[] }[] = []
    for (const e of events ?? []) {
      const d = e.all_day
        ? dayHeader.format(new Date(e.start_at.slice(0, 10) + 'T12:00:00'))
        : dayHeader.format(new Date(e.start_at))
      const last = groups[groups.length - 1]
      if (last && last.day === d) last.events.push(e)
      else groups.push({ day: d, events: [e] })
    }
    return groups
  }, [events])

  return (
    <>
      <div className="top">
        <p className="muted small">{events ? `${events.length} eventos nos próximos ${days} dias` : 'A carregar…'}</p>
        <div className="row">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 dias</option>
            <option value={14}>14 dias</option>
            <option value={30}>30 dias</option>
          </select>
          <button onClick={load}>↻</button>
        </div>
      </div>
      <AlertsPanel onCount={onAlerts} />
      {error && <p className="error">{error}</p>}
      {events && events.length === 0 && <p className="empty">Sem eventos neste período.</p>}

      {byDay.map((g) => (
        <section key={g.day}>
          <h2 className="section-title">{g.day}</h2>
          {g.events.map((e) =>
            openId === e.id ? (
              <div key={e.id}>
                <button className="ghost small collapse" onClick={() => setOpenId(null)}>▲ Fechar</button>
                <BriefingView eventId={e.id} />
              </div>
            ) : (
              <button key={e.id} className="item-row" onClick={() => setOpenId(e.id)}>
                <span className="event-time">{e.all_day ? 'dia' : hour.format(new Date(e.start_at))}</span>
                <span className="item-row-main">
                  <span className="item-row-title">{e.title}</span>
                  <span className="muted small">{EVENT_TYPES[e.event_type] ?? e.event_type}</span>
                </span>
                <span className="item-row-meta small muted">Briefing ›</span>
              </button>
            ),
          )}
        </section>
      ))}
    </>
  )
}
