import { useState } from 'react'
import { fmtDate } from '../lib/format'
import { EVENT_TYPES, type Ref, type Scope } from '../lib/types'

type Props = {
  scopes: Scope[]
  groups: Ref[]
  editing: boolean
  onAdd?: (s: { event_type: string | null; group_id: string | null; valid_until: string | null }) => void
  onRemove?: (id: string) => void
}

export function scopeLabel(s: Scope): string {
  const type = EVENT_TYPES[s.event_type ?? 'Any'] ?? s.event_type
  const group = s.groups?.name ?? 'qualquer grupo'
  const until = s.valid_until ? `até ${fmtDate(s.valid_until)}` : 'sem fim'
  return `${type} · ${group} · ${until}`
}

// Regras "aplica-se a…": mostra e, em edição, permite acrescentar/remover
export default function ScopeEditor({ scopes, groups, editing, onAdd, onRemove }: Props) {
  const [type, setType] = useState('Training')
  const [groupId, setGroupId] = useState('')
  const [until, setUntil] = useState('')

  if (!editing && scopes.length === 0) return null

  return (
    <div className="links">
      <span className="links-label">Aplica-se a</span>
      <div className="chips">
        {scopes.map((s) => (
          <span key={s.id} className="chip">
            {scopeLabel(s)}
            {editing && onRemove && (
              <button className="chip-x" onClick={() => onRemove(s.id)} aria-label="Remover regra">×</button>
            )}
          </span>
        ))}
        {scopes.length === 0 && <span className="muted small">Só a este item (sem regra)</span>}
      </div>
      {editing && onAdd && (
        <div className="row">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(EVENT_TYPES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Qualquer grupo</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <label className="inline">
            até
            <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </label>
          <button
            onClick={() => {
              onAdd({
                event_type: type === 'Any' ? null : type,
                group_id: groupId || null,
                valid_until: until ? new Date(`${until}T23:59:59`).toISOString() : null,
              })
              setUntil('')
            }}
          >
            + Regra
          </button>
        </div>
      )}
    </div>
  )
}
