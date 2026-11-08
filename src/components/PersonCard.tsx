import { useEffect, useState } from 'react'
import * as P from '../lib/people'
import { fmtDate, fmtEvent } from '../lib/format'
import { ITEM_STATUSES, ITEM_TYPES, PERSON_TYPES, type Refs } from '../lib/types'

type Props = { person: P.PersonRow; refs: Refs; onChanged: () => void }

const EMPTY_ATHLETE = { position: '', current_restrictions: '', development_goals: '', problematic_exercises: '' }

// Ficha de uma pessoa: dados base, grupos, contactos, notas, dados de atleta e histórico
export default function PersonCard({ person, refs, onChanged }: Props) {
  const [form, setForm] = useState({
    name: person.name,
    person_type: person.person_type,
    main_context_id: person.main_context_id,
    email: person.email ?? '',
    phone: person.phone ?? '',
    notes: person.notes ?? '',
    active: person.active,
  })
  const [aliases, setAliases] = useState<string[]>(person.aliases ?? [])
  const [newAlias, setNewAlias] = useState('')
  const [athlete, setAthlete] = useState(EMPTY_ATHLETE)
  const [history, setHistory] = useState<P.PersonHistory | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAthlete = form.person_type === 'Athlete'
  const groups = person.group_people.map((g) => g.groups).filter((g): g is { id: string; name: string } => !!g)
  const otherGroups = refs.groups.filter((g) => !groups.some((x) => x.id === g.id))

  useEffect(() => {
    P.loadHistory(person.id).then(setHistory).catch(() => setHistory({ items: [], events: [] }))
    P.loadAthlete(person.id).then((a) => {
      if (a) {
        setAthlete({
          position: a.position ?? '',
          current_restrictions: a.current_restrictions ?? '',
          development_goals: a.development_goals ?? '',
          problematic_exercises: a.problematic_exercises ?? '',
        })
      }
    })
  }, [person.id])

  async function act(fn: () => Promise<unknown>, reload = true) {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await fn()
      setSaved(true)
      if (reload) onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveAll() {
    await act(async () => {
      await P.updatePerson(person.id, {
        ...form,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        aliases,
      })
      if (isAthlete) {
        const clean = Object.fromEntries(Object.entries(athlete).map(([k, v]) => [k, v.trim() || null]))
        await P.saveAthlete(person.id, clean as Omit<P.AthleteRow, 'id' | 'person_id'>)
      }
    })
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  return (
    <article className={`card ${busy ? 'busy' : ''}`}>
      {/* Dados base */}
      <div className="stack">
        <label>
          Nome
          <input value={form.name} onChange={set('name')} />
        </label>
        <div className="row">
          <label>
            Tipo
            <select value={form.person_type} onChange={set('person_type')}>
              {Object.entries(PERSON_TYPES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Contexto
            <select value={form.main_context_id} onChange={set('main_context_id')}>
              {refs.contexts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="inline">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Ativo
          </label>
        </div>
      </div>

      {/* Grupos (gravam logo) */}
      <div className="links">
        <span className="links-label">Grupos</span>
        <div className="chips">
          {groups.map((g) => (
            <span key={g.id} className="chip">
              {g.name}
              <button className="chip-x" onClick={() => act(() => P.removeFromGroup(person.id, g.id))} aria-label={`Remover de ${g.name}`}>×</button>
            </span>
          ))}
          {groups.length === 0 && <span className="muted small">Sem grupo</span>}
        </div>
        {otherGroups.length > 0 && (
          <select value="" onChange={(e) => e.target.value && act(() => P.addToGroup(person.id, e.target.value))}>
            <option value="">+ juntar a um grupo…</option>
            {otherGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Outras formas de escrever o nome */}
      <div className="links">
        <span className="links-label">Também conhecido por (a IA reconhece estes nomes)</span>
        <div className="chips">
          {aliases.map((a) => (
            <span key={a} className="chip">
              {a}
              <button className="chip-x" onClick={() => setAliases(aliases.filter((x) => x !== a))} aria-label={`Remover ${a}`}>×</button>
            </span>
          ))}
        </div>
        <div className="row">
          <input placeholder="ex: Relvão" value={newAlias} onChange={(e) => setNewAlias(e.target.value)} />
          <button
            disabled={!newAlias.trim()}
            onClick={() => {
              if (!aliases.includes(newAlias.trim())) setAliases([...aliases, newAlias.trim()])
              setNewAlias('')
            }}
          >
            Acrescentar
          </button>
        </div>
      </div>

      {/* Contactos e notas */}
      <div className="links stack">
        <span className="links-label">Contactos</span>
        <div className="row">
          <label className="grow">
            Telefone
            <input type="tel" value={form.phone} onChange={set('phone')} />
          </label>
          <label className="grow">
            Email
            <input type="email" value={form.email} onChange={set('email')} />
          </label>
        </div>
        <label>
          Notas
          <textarea rows={3} value={form.notes} onChange={set('notes')} />
        </label>
      </div>

      {/* Dados de atleta */}
      {isAthlete && (
        <div className="links stack">
          <span className="links-label">Atleta</span>
          <label>
            Posição
            <input value={athlete.position} onChange={(e) => setAthlete({ ...athlete, position: e.target.value })} />
          </label>
          <label>
            Restrições atuais
            <textarea rows={2} value={athlete.current_restrictions} onChange={(e) => setAthlete({ ...athlete, current_restrictions: e.target.value })} />
          </label>
          <label>
            Objetivos de desenvolvimento
            <textarea rows={2} value={athlete.development_goals} onChange={(e) => setAthlete({ ...athlete, development_goals: e.target.value })} />
          </label>
          <label>
            Exercícios problemáticos
            <textarea rows={2} value={athlete.problematic_exercises} onChange={(e) => setAthlete({ ...athlete, problematic_exercises: e.target.value })} />
          </label>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <footer className="row actions">
        <button className="primary" disabled={busy || !form.name.trim()} onClick={saveAll}>Guardar</button>
        {saved && <span className="muted small">✓ Guardado</span>}
      </footer>

      {/* Histórico */}
      <div className="links">
        <span className="links-label">Registos ({history?.items.length ?? '…'})</span>
        {history?.items.slice(0, 20).map((i) => (
          <div key={i.id} className="list-row small">
            <span>
              <span className={`badge type-${i.item_type}`}>{ITEM_TYPES[i.item_type] ?? i.item_type}</span> {i.title}
            </span>
            <span className="muted">
              {i.status !== 'Open' ? `${ITEM_STATUSES[i.status] ?? i.status} · ` : ''}
              {fmtDate(i.created_at)}
            </span>
          </div>
        ))}
        {history && history.items.length === 0 && <span className="muted small">Ainda sem registos.</span>}
      </div>
      <div className="links">
        <span className="links-label">Eventos ({history?.events.length ?? '…'})</span>
        {history?.events.slice(0, 10).map((e) => (
          <div key={e.id} className="list-row small">
            <span>{e.title}{e.status === 'Cancelled' ? ' (cancelado)' : ''}</span>
            <span className="muted">{fmtEvent(e)}</span>
          </div>
        ))}
        {history && history.events.length === 0 && <span className="muted small">Ainda sem eventos.</span>}
      </div>
    </article>
  )
}
