import { useState } from 'react'
import type { Ref } from '../lib/types'

type Props = {
  label: string
  current: Ref[]
  options: Ref[]
  editing: boolean
  onAdd: (id: string) => void
  onRemove: (id: string) => void
  onCreate?: (name: string) => void // só para tags: criar nova
}

// Mostra as ligações de um item (pessoas, grupos, tags, eventos) como "chips".
// Em modo de edição permite remover e acrescentar.
export default function LinkEditor({ label, current, options, editing, onAdd, onRemove, onCreate }: Props) {
  const [newName, setNewName] = useState('')
  if (!editing && current.length === 0) return null

  const available = options.filter((o) => !current.some((c) => c.id === o.id))

  return (
    <div className="links">
      <span className="links-label">{label}</span>
      <div className="chips">
        {current.map((c) => (
          <span key={c.id} className="chip">
            {c.name}
            {editing && (
              <button className="chip-x" onClick={() => onRemove(c.id)} aria-label={`Remover ${c.name}`}>
                ×
              </button>
            )}
          </span>
        ))}
        {!editing && current.length === 0 && <span className="muted">—</span>}
      </div>
      {editing && (
        <div className="row">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onAdd(e.target.value)
            }}
          >
            <option value="">+ acrescentar…</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {onCreate && (
            <>
              <input placeholder="ou nova…" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <button
                disabled={!newName.trim()}
                onClick={() => {
                  onCreate(newName)
                  setNewName('')
                }}
              >
                Criar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
