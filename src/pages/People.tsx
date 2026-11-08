import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPerson, listPeople, type PersonRow } from '../lib/people'
import { loadRefs } from '../lib/queries'
import { PERSON_TYPES, type Refs } from '../lib/types'
import PersonCard from '../components/PersonCard'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export default function People() {
  const [people, setPeople] = useState<PersonRow[] | null>(null)
  const [refs, setRefs] = useState<Refs | null>(null)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [groupId, setGroupId] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [p, r] = await Promise.all([listPeople(), loadRefs()])
      setPeople(p)
      setRefs(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = norm(search)
    return (people ?? []).filter((p) => {
      if (!showInactive && !p.active) return false
      if (type && p.person_type !== type) return false
      if (groupId && !p.group_people.some((g) => g.groups?.id === groupId)) return false
      if (q && !norm(p.name).includes(q) && !p.aliases.some((a) => norm(a).includes(q))) return false
      return true
    })
  }, [people, search, type, groupId, showInactive])

  return (
    <>
      <div className="row filters">
        <input className="grow" placeholder="Pesquisar nome (ou alcunha)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="primary" onClick={() => setCreating(!creating)}>+ Pessoa</button>
      </div>
      <div className="row filters">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(PERSON_TYPES).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Todos os grupos</option>
          {(refs?.groups ?? []).map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <label className="inline small">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar inativos
        </label>
      </div>

      {creating && refs && (
        <NewPerson
          refs={refs}
          onCancel={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false)
            await load()
            setOpenId(id)
          }}
        />
      )}

      <p className="muted small">{people ? `${filtered.length} ${filtered.length === 1 ? 'pessoa' : 'pessoas'}` : 'A carregar…'}</p>
      {error && <p className="error">{error}</p>}

      {refs &&
        filtered.map((p) =>
          openId === p.id ? (
            <div key={p.id}>
              <button className="ghost small collapse" onClick={() => setOpenId(null)}>▲ Fechar</button>
              <PersonCard person={p} refs={refs} onChanged={load} />
            </div>
          ) : (
            <button key={p.id} className="item-row" onClick={() => setOpenId(p.id)}>
              <span className={`badge ptype-${p.person_type}`}>{PERSON_TYPES[p.person_type] ?? p.person_type}</span>
              <span className="item-row-main">
                <span className="item-row-title">
                  {p.name}
                  {!p.active && <span className="muted small"> (inativo)</span>}
                </span>
                <span className="muted small">
                  {p.group_people.map((g) => g.groups?.name).filter(Boolean).join(' · ') || 'sem grupo'}
                </span>
              </span>
              <span className="item-row-meta small muted">{p.phone ?? p.email ?? ''}</span>
            </button>
          ),
        )}
    </>
  )
}

function NewPerson(props: { refs: Refs; onCancel: () => void; onCreated: (id: string) => void }) {
  const defaultContext = props.refs.contexts.find((c) => c.name === 'Profissional')?.id ?? props.refs.contexts[0]?.id ?? ''
  const [name, setName] = useState('')
  const [personType, setPersonType] = useState('Athlete')
  const [contextId, setContextId] = useState(defaultContext)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const id = await createPerson({ name, person_type: personType, main_context_id: contextId })
      props.onCreated(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="card stack">
      <h3>Nova pessoa</h3>
      <label>
        Nome completo
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div className="row">
        <label>
          Tipo
          <select value={personType} onChange={(e) => setPersonType(e.target.value)}>
            {Object.entries(PERSON_TYPES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          Contexto
          <select value={contextId} onChange={(e) => setContextId(e.target.value)}>
            {props.refs.contexts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" disabled={busy || !name.trim() || !contextId} onClick={save}>Criar</button>
        <button className="ghost" onClick={props.onCancel}>Cancelar</button>
      </div>
      <p className="hint">Depois de criar, abre-se a ficha para acrescentares grupos, contactos e o resto.</p>
    </div>
  )
}
