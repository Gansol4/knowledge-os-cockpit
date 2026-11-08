import { useState } from 'react'
import * as A from '../lib/actions'
import { fmtDateTime, fmtEvent, fromLocalInput, toLocalInput } from '../lib/format'
import { ITEM_STATUSES, ITEM_TYPES, REVIEW_RESULTS, type InboxItem, type Ref, type Refs } from '../lib/types'
import LinkEditor from './LinkEditor'
import MentionResolver from './MentionResolver'
import ScopeEditor from './ScopeEditor'

// mode "inbox": validar (Confirmar / Ignorar). mode "item": consulta e edição a qualquer momento (estado, histórico).
type Props = { item: InboxItem; refs: Refs; onChanged: () => void; mode?: 'inbox' | 'item'; startEditing?: boolean }

// Campo de data editável (prazo, próxima revisão)
function DateField(props: {
  label: string
  value: string | null
  editing: boolean
  onSave: (iso: string | null) => void
}) {
  if (!props.value && !props.editing) return null
  return (
    <div className="links">
      <span className="links-label">{props.label}</span>
      {props.editing ? (
        <input
          type="datetime-local"
          defaultValue={toLocalInput(props.value)}
          onBlur={(e) => {
            const iso = fromLocalInput(e.target.value)
            if (iso !== props.value) props.onSave(iso)
          }}
        />
      ) : (
        <span>{fmtDateTime(props.value)}</span>
      )}
    </div>
  )
}

export default function InboxCard({ item, refs, onChanged, mode = 'inbox', startEditing = false }: Props) {
  const [editing, setEditing] = useState(startEditing)
  const [title, setTitle] = useState(item.title)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Executa uma ação, mostra erro se falhar e recarrega a lista
  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const people = item.item_people.map((x) => x.people).filter((x): x is Ref => !!x)
  const groups = item.item_groups.map((x) => x.groups).filter((x): x is Ref => !!x)
  const tags = item.item_tags.map((x) => x.tags).filter((x): x is Ref => !!x)
  const events = item.event_items
    .map((x) => x.events)
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((e) => ({ id: e.id, name: `${e.title} · ${fmtEvent(e)}` }))
  const eventOptions = refs.events.map((e) => ({ id: e.id, name: `${e.title} · ${fmtEvent(e)}` }))
  const pending = item.item_mentions.filter((m) => m.status === 'pending')

  return (
    <article className={`card ${busy ? 'busy' : ''}`}>
      <header className="card-head">
        {editing ? (
          <select value={item.item_type} onChange={(e) => act(() => A.updateItem(item.id, { item_type: e.target.value }))}>
            {Object.entries(ITEM_TYPES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        ) : (
          <span className={`badge type-${item.item_type}`}>{ITEM_TYPES[item.item_type] ?? item.item_type}</span>
        )}
        <span className="muted small">
          {item.source === 'Voice' ? '🎙️' : '💬'} {fmtDateTime(item.created_at)}
        </span>
      </header>

      {editing ? (
        <div className="row">
          <input className="grow" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button disabled={title === item.title} onClick={() => act(() => A.updateItem(item.id, { title }))}>
            Guardar
          </button>
        </div>
      ) : (
        <h3>{item.title}</h3>
      )}

      {item.description && item.description !== item.title && <blockquote>{item.description}</blockquote>}

      {item.ai_interpretation?.confidence_reason && (
        <p className="reason">
          <b>Porque está aqui:</b> {item.ai_interpretation.confidence_reason}
        </p>
      )}

      <LinkEditor
        label="Pessoas"
        current={people}
        options={refs.people}
        editing={editing}
        onAdd={(id) => act(() => A.addLink('person', item.id, id))}
        onRemove={(id) => act(() => A.removeLink('person', item.id, id))}
      />
      <LinkEditor
        label="Grupos"
        current={groups}
        options={refs.groups}
        editing={editing}
        onAdd={(id) => act(() => A.addLink('group', item.id, id))}
        onRemove={(id) => act(() => A.removeLink('group', item.id, id))}
      />
      <LinkEditor
        label="Tags"
        current={tags}
        options={refs.tags}
        editing={editing}
        onAdd={(id) => act(() => A.addLink('tag', item.id, id))}
        onRemove={(id) => act(() => A.removeLink('tag', item.id, id))}
        onCreate={(name) => act(() => A.addNewTag(item.id, name))}
      />
      <LinkEditor
        label="Eventos"
        current={events}
        options={eventOptions}
        editing={editing}
        onAdd={(id) => act(() => A.addLink('event', item.id, id))}
        onRemove={(id) => act(() => A.removeLink('event', item.id, id))}
      />

      <ScopeEditor
        scopes={item.item_scopes}
        groups={refs.groups}
        editing={editing}
        onAdd={(s) => act(() => A.addScope(item.id, s))}
        onRemove={(id) => act(() => A.removeScope(id, item.id))}
      />

      <DateField
        label="Prazo"
        value={item.due_at}
        editing={editing}
        onSave={(iso) => act(() => A.updateItem(item.id, { due_at: iso }))}
      />
      <DateField
        label="Próxima revisão"
        value={item.next_review_at}
        editing={editing}
        onSave={(iso) => act(() => A.updateItem(item.id, { next_review_at: iso }))}
      />

      {pending.map((m) => (
        <MentionResolver
          key={m.id}
          mention={m}
          refs={refs}
          onLink={(id) => act(() => A.resolveMention(m, item.id, id, refs))}
          onCreatePerson={(p) => act(() => A.createPersonFromMention(m, item.id, p))}
          onIgnore={() => act(() => A.ignoreMention(m, item.id))}
        />
      ))}

      {mode === 'item' && item.reviews && item.reviews.length > 0 && (
        <div className="links">
          <span className="links-label">Histórico de revisões</span>
          {[...item.reviews]
            .sort((a, b) => b.review_date.localeCompare(a.review_date))
            .map((h, i) => (
              <div key={i} className="small">
                <b>{fmtDateTime(h.review_date)}</b> · {REVIEW_RESULTS[h.result] ?? h.result}
                {h.notes ? ` — ${h.notes}` : ''}
              </div>
            ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {mode === 'inbox' ? (
        <footer className="row actions">
          <button className="primary" disabled={busy} onClick={() => act(() => A.confirmItem(item.id))}>
            ✓ Confirmar{pending.length ? ` (${pending.length} por resolver)` : ''}
          </button>
          <button disabled={busy} onClick={() => setEditing(!editing)}>{editing ? 'Fechar edição' : 'Editar'}</button>
          <button className="ghost" disabled={busy} onClick={() => act(() => A.ignoreItem(item.id))}>Ignorar</button>
        </footer>
      ) : (
        <footer className="row actions">
          <label className="inline">
            Estado
            <select
              value={item.status}
              disabled={busy}
              onChange={(e) => act(() => A.updateItem(item.id, { status: e.target.value }))}
            >
              {Object.entries(ITEM_STATUSES).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <button disabled={busy} onClick={() => setEditing(!editing)}>{editing ? 'Fechar edição' : 'Editar'}</button>
          {item.classification_status === 'PendingValidation' && (
            <button className="primary" disabled={busy} onClick={() => act(() => A.confirmItem(item.id))}>
              ✓ Validar
            </button>
          )}
        </footer>
      )}
    </article>
  )
}
