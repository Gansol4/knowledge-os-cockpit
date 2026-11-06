import { useState } from 'react'
import * as A from '../lib/actions'
import { fmtDate, fmtDateTime, fromLocalInput, inDaysAt9, toLocalInput } from '../lib/format'
import { ITEM_TYPES, REVIEW_RESULTS, type Ref, type ReviewItem } from '../lib/types'
import ScopeEditor from './ScopeEditor'

type Props = { item: ReviewItem; onChanged: () => void }

// Uma revisão é uma decisão sobre a continuidade da relevância de um item (nota 03).
export default function ReviewCard({ item, onChanged }: Props) {
  const [notes, setNotes] = useState('')
  const [later, setLater] = useState(toLocalInput(inDaysAt9(3)))
  const [showLater, setShowLater] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(result: A.ReviewResult, next: string | null) {
    setBusy(true)
    setError(null)
    try {
      await A.recordReview(item.id, result, notes, next)
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
  const overdue = item.next_review_at && new Date(item.next_review_at) < new Date(new Date().setHours(0, 0, 0, 0))
  const history = [...item.reviews].sort((a, b) => b.review_date.localeCompare(a.review_date)).slice(0, 3)

  return (
    <article className={`card ${busy ? 'busy' : ''}`}>
      <header className="card-head">
        <span className={`badge type-${item.item_type}`}>{ITEM_TYPES[item.item_type] ?? item.item_type}</span>
        <span className={`small ${overdue ? 'error' : 'muted'}`}>Rever: {fmtDateTime(item.next_review_at)}</span>
      </header>

      <h3>{item.title}</h3>
      {item.description && item.description !== item.title && <blockquote>{item.description}</blockquote>}

      {[...people, ...groups, ...tags].length > 0 && (
        <div className="chips">
          {[...people, ...groups, ...tags].map((r) => (
            <span key={r.id} className="chip">{r.name}</span>
          ))}
        </div>
      )}

      <ScopeEditor scopes={item.item_scopes} groups={[]} editing={false} />

      {history.length > 0 && (
        <div className="links">
          <span className="links-label">Revisões anteriores</span>
          {history.map((h, i) => (
            <div key={i} className="small">
              <b>{fmtDate(h.review_date)}</b> · {REVIEW_RESULTS[h.result] ?? h.result}
              {h.notes ? ` — ${h.notes}` : ''}
            </div>
          ))}
        </div>
      )}

      <label>
        Notas da revisão (opcional)
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: sem agravamento, manter monitorização" />
      </label>

      {showLater && (
        <div className="row" style={{ marginTop: 8 }}>
          <input type="datetime-local" value={later} onChange={(e) => setLater(e.target.value)} />
          <button className="primary" onClick={() => decide('ReviewLater', fromLocalInput(later))}>Adiar para esta data</button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <footer className="row actions">
        <button className="primary" disabled={busy} onClick={() => decide(notes.trim() ? 'Update' : 'Maintain', inDaysAt9(7))}>
          Manter (+7 dias)
        </button>
        <button disabled={busy} onClick={() => setShowLater(!showLater)}>Rever mais tarde…</button>
        <button disabled={busy} onClick={() => decide('Complete', null)}>✓ Concluir</button>
        <button className="ghost" disabled={busy} onClick={() => decide('Archive', null)}>Arquivar</button>
      </footer>
    </article>
  )
}
