import { useState } from 'react'
import { KIND_LABEL, PERSON_TYPES, type Mention, type Refs } from '../lib/types'
import { fmtEvent } from '../lib/format'

type Props = {
  mention: Mention
  refs: Refs
  onLink: (entityId: string) => void
  onCreatePerson: (p: { name: string; person_type: string; main_context_id: string; group_id: string }) => void
  onIgnore: () => void
}

function titleCase(s: string) {
  return s.trim().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())
}

// Resolver uma menção que a IA não conseguiu associar ("Luke", "o coach", "jogo de sábado")
export default function MentionResolver({ mention, refs, onLink, onCreatePerson, onIgnore }: Props) {
  const [mode, setMode] = useState<'idle' | 'link' | 'create'>('idle')
  const [selected, setSelected] = useState(mention.suggested_entity_id ?? '')
  const defaultContext = refs.contexts.find((c) => c.name === 'Profissional')?.id ?? refs.contexts[0]?.id ?? ''
  const [person, setPerson] = useState({
    name: titleCase(mention.mention_text),
    person_type: 'Athlete',
    main_context_id: defaultContext,
    group_id: '',
  })

  const options =
    mention.entity_kind === 'person'
      ? refs.people.map((p) => ({ id: p.id, label: `${p.name} (${PERSON_TYPES[p.person_type] ?? p.person_type})` }))
      : mention.entity_kind === 'group'
        ? refs.groups.map((g) => ({ id: g.id, label: g.name }))
        : refs.events.map((e) => ({ id: e.id, label: `${e.title} · ${fmtEvent(e)}` }))

  return (
    <div className="mention">
      <div>
        <span className="tag-kind">{KIND_LABEL[mention.entity_kind]} por resolver</span> <b>“{mention.mention_text}”</b>
      </div>

      {mode === 'idle' && (
        <div className="row">
          <button onClick={() => setMode('link')}>É {mention.entity_kind === 'event' ? 'um evento' : 'alguém'} que já existe</button>
          {mention.entity_kind === 'person' && <button onClick={() => setMode('create')}>Criar pessoa nova</button>}
          <button className="ghost" onClick={onIgnore}>Ignorar</button>
        </div>
      )}

      {mode === 'link' && (
        <div className="row">
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Escolher…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button className="primary" disabled={!selected} onClick={() => onLink(selected)}>Ligar</button>
          <button className="ghost" onClick={() => setMode('idle')}>Cancelar</button>
          {mention.entity_kind !== 'event' && (
            <p className="hint">“{mention.mention_text}” fica guardado como outra forma de escrever o nome.</p>
          )}
        </div>
      )}

      {mode === 'create' && (
        <div className="stack">
          <label>
            Nome completo
            <input value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} />
          </label>
          <div className="row">
            <label>
              Tipo
              <select value={person.person_type} onChange={(e) => setPerson({ ...person, person_type: e.target.value })}>
                {Object.entries(PERSON_TYPES).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label>
              Contexto
              <select
                value={person.main_context_id}
                onChange={(e) => setPerson({ ...person, main_context_id: e.target.value })}
              >
                {refs.contexts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>
              Grupo
              <select value={person.group_id} onChange={(e) => setPerson({ ...person, group_id: e.target.value })}>
                <option value="">Nenhum</option>
                {refs.groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <button
              className="primary"
              disabled={!person.name.trim() || !person.main_context_id}
              onClick={() => onCreatePerson(person)}
            >
              Criar e ligar
            </button>
            <button className="ghost" onClick={() => setMode('idle')}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
