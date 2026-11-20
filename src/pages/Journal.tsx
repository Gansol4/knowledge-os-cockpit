import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/format'
import MoodChart, { type DayPoint } from '../components/MoodChart'

type Entry = {
  id: string
  created_at: string
  entry_date: string
  questions: string | null
  content: string
  source: string
  energy: number | null
  mood: number | null
  highlights: string[]
  lessons: string[]
  challenge_done: boolean | null
}
type Challenge = { day: string; quote: string | null; author: string | null; challenge: string; done: boolean | null }
type Reminder = { id: string; remind_at: string; text: string; source: string }

const DAYS = 30
const fmtDay = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: '2-digit', month: '2-digit' })
const dayLabel = (ymd: string) => fmtDay.format(new Date(ymd + 'T12:00:00'))
const localYmd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(d)

function avg(xs: (number | null)[]) {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'
}

// Diário: energia e estado ao longo do tempo, desafios do dia, lembretes pendentes e as entradas
export default function Journal() {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const since = localYmd(new Date(Date.now() - (DAYS - 1) * 86_400_000))
    const [e, c, r] = await Promise.all([
      supabase.from('journal_entries')
        .select('id, created_at, entry_date, questions, content, source, energy, mood, highlights, lessons, challenge_done')
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(120),
      supabase.from('daily_challenges').select('day, quote, author, challenge, done').gte('day', since).order('day', { ascending: false }),
      supabase.from('reminders').select('id, remind_at, text, source').eq('status', 'pending').order('remind_at'),
    ])
    const err = e.error ?? c.error ?? r.error
    if (err) setError(err.message)
    setEntries((e.data ?? []) as Entry[])
    setChallenges((c.data ?? []) as Challenge[])
    setReminders((r.data ?? []) as Reminder[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Um ponto por dia (últimos 30); vários registos no mesmo dia → média
  const points: DayPoint[] = useMemo(() => {
    const byDay = new Map<string, Entry[]>()
    for (const x of entries ?? []) byDay.set(x.entry_date, [...(byDay.get(x.entry_date) ?? []), x])
    const out: DayPoint[] = []
    for (let i = DAYS - 1; i >= 0; i--) {
      const day = localYmd(new Date(Date.now() - i * 86_400_000))
      const xs = byDay.get(day) ?? []
      const mean = (k: 'energy' | 'mood') => {
        const v = xs.map((x) => x[k]).filter((n): n is number => n != null)
        return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
      }
      out.push({ day, energy: mean('energy'), mood: mean('mood') })
    }
    return out
  }, [entries])

  const recent = (entries ?? []).filter((x) => x.entry_date >= points[0]?.day)
  const answered = challenges.filter((c) => c.done != null)
  const done = challenges.filter((c) => c.done === true).length

  async function cancelReminder(id: string) {
    const { error } = await supabase.from('reminders').update({ status: 'cancelled' }).eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  if (!entries) return <p className="muted">A carregar…</p>

  return (
    <>
      {error && <p className="error">{error}</p>}

      <section className="tiles">
        <div className="tile">
          <span className="tile-label">Entradas (30 dias)</span>
          <span className="tile-value">{new Set(recent.map((x) => x.entry_date)).size}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Energia média</span>
          <span className="tile-value">{avg(recent.map((x) => x.energy))}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Estado médio</span>
          <span className="tile-value">{avg(recent.map((x) => x.mood))}</span>
        </div>
        <div className="tile">
          <span className="tile-label">Desafios cumpridos</span>
          <span className="tile-value">{answered.length ? `${done}/${answered.length}` : '–'}</span>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Energia e estado</h3>
          <button className="ghost small" onClick={() => setShowTable(!showTable)}>{showTable ? 'Ver gráfico' : 'Ver tabela'}</button>
        </div>
        {recent.length === 0 ? (
          <p className="muted small">Ainda sem entradas nos últimos 30 dias. Responde às perguntas do diário no fecho das 21:30.</p>
        ) : showTable ? (
          <table className="data">
            <thead><tr><th>Dia</th><th>Energia</th><th>Estado</th></tr></thead>
            <tbody>
              {[...points].reverse().filter((p) => p.energy != null || p.mood != null).map((p) => (
                <tr key={p.day}><td>{dayLabel(p.day)}</td><td>{p.energy ?? '–'}</td><td>{p.mood ?? '–'}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <MoodChart points={points} />
        )}
      </section>

      {reminders.length > 0 && (
        <section>
          <h2 className="section-title">⏰ Lembretes pendentes</h2>
          {reminders.map((r) => (
            <div key={r.id} className="item-row static">
              <span className="event-time small">{fmtDateTime(r.remind_at)}</span>
              <span className="item-row-main">{r.text}</span>
              <button className="ghost small" onClick={() => cancelReminder(r.id)}>Cancelar</button>
            </div>
          ))}
        </section>
      )}

      {challenges.length > 0 && (
        <section>
          <h2 className="section-title">🎯 Desafios</h2>
          {challenges.slice(0, 10).map((c) => {
            const [main, ...rest] = c.challenge.split('\n')
            return (
              <article key={c.day} className="card">
                <header className="card-head">
                  <span className="small muted">{dayLabel(c.day)}</span>
                  <span className="small">
                    {c.done === true ? '✓ Cumprido' : c.done === false ? '✗ Por cumprir' : '– Sem resposta'}
                  </span>
                </header>
                {c.quote && (
                  <blockquote>
                    {!c.author ? c.quote : c.author.startsWith('a partir de') ? `${c.quote} (${c.author})` : `"${c.quote}" — ${c.author}`}
                  </blockquote>
                )}
                <div className="small">🎯 {main}</div>
                {rest.map((r, i) => <div key={i} className="small">❤️ {r.replace(/^❤️\s*/, '')}</div>)}
              </article>
            )
          })}
        </section>
      )}

      <section>
        <h2 className="section-title">📓 Entradas</h2>
        {entries.length === 0 && <p className="empty">Ainda sem entradas.</p>}
        {entries.map((x) => (
          <article key={x.id} className="card">
            <header className="card-head">
              <b>{dayLabel(x.entry_date)}</b>
              <span className="small muted">
                {x.source === 'Voice' ? '🎙️' : '💬'}
                {x.energy != null ? ` · energia ${x.energy}/5` : ''}
                {x.mood != null ? ` · estado ${x.mood}/5` : ''}
                {x.challenge_done === true ? ' · 🎯 ✓' : x.challenge_done === false ? ' · 🎯 ✗' : ''}
              </span>
            </header>
            {x.highlights?.length > 0 && (
              <div className="links">
                <span className="links-label">Destaques</span>
                {x.highlights.map((h, i) => <div key={i} className="small">• {h}</div>)}
              </div>
            )}
            {x.lessons?.length > 0 && (
              <div className="links">
                <span className="links-label">Aprendizagens</span>
                {x.lessons.map((h, i) => <div key={i} className="small">💡 {h}</div>)}
              </div>
            )}
            {open === x.id ? (
              <>
                {x.questions && <p className="small muted">{x.questions.split(' | ').join(' · ')}</p>}
                <blockquote>{x.content}</blockquote>
                <button className="ghost small" onClick={() => setOpen(null)}>▲ Esconder texto</button>
              </>
            ) : (
              <button className="ghost small" onClick={() => setOpen(x.id)}>▼ Ver o que disseste</button>
            )}
          </article>
        ))}
      </section>
    </>
  )
}
