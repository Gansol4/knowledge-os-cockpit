import { useState } from 'react'
import * as A from '../lib/actions'
import { dailyReviewOf, fmtDate, fmtDateTime, fmtEvent, localDay, nextWeeklyReview } from '../lib/format'
import { ITEM_TYPES, REVIEW_RESULTS, TREND_LABELS, type Ref, type Refs, type ReviewItem } from '../lib/types'
import InboxCard from './InboxCard'
import ScopeEditor from './ScopeEditor'

type Props = { item: ReviewItem; refs: Refs; onChanged: () => void }

const RULE_LABEL: Record<string, string> = {
  event: 'pelo evento',
  weekly: 'revisão semanal',
  manual: 'data escolhida por ti',
  daily: 'conhecimento: guardar ou arquivar',
  case: 'caso em acompanhamento (revisto todos os dias)',
  explicit: 'data pedida na mensagem',
}

// Uma revisão é uma decisão sobre a continuidade da relevância de um item (nota 03).
// Opções: concluir · associar a próximo(s) evento(s) · rever noutro dia · revisão de domingo · arquivar
export default function ReviewCard({ item, refs, onChanged }: Props) {
  const [notes, setNotes] = useState('')
  const [mode, setMode] = useState<'none' | 'events' | 'day' | 'edit'>('none')
  const [day, setDay] = useState(localDay(1))
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // Conhecimento: concluir = fica guardado (pesquisável, na ficha das pessoas, nas tags)
  const isKnowledge = item.item_type === 'Learning' || item.item_type === 'Reference'
  // Caso em acompanhamento: mantém-se · melhorou · já passou (cada resposta fica na linha do tempo)
  const isCase = item.review_rule === 'case'
  const updates = [...(item.item_updates ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const daysOpen = Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86_400_000)
  const tomorrow = () => dailyReviewOf(localDay(1))
  const caseStep = (trend: string, fallback: string, result: 'Maintain' | 'Update' | 'Complete') =>
    act(async () => {
      await A.addUpdate(item.id, notes.trim() || fallback, trend)
      await A.recordReview(item.id, result, notes, result === 'Complete' ? null : tomorrow(), 'case')
    })
  const people = item.item_people.map((x) => x.people).filter((x): x is Ref => !!x)
  const groups = item.item_groups.map((x) => x.groups).filter((x): x is Ref => !!x)
  const tags = item.item_tags.map((x) => x.tags).filter((x): x is Ref => !!x)
  const linkedEvents = item.event_items.map((x) => x.events).filter((x): x is NonNullable<typeof x> => !!x)
  const overdue = item.next_review_at && new Date(item.next_review_at) < new Date(new Date().setHours(0, 0, 0, 0))
  const history = [...item.reviews].sort((a, b) => b.review_date.localeCompare(a.review_date)).slice(0, 3)
  const upcoming = refs.events.filter((e) => new Date(e.start_at) > new Date() && !linkedEvents.some((l) => l.id === e.id))

  // Editar o item completo (mesmo cartão da lista de Itens)
  if (mode === 'edit') {
    return (
      <div>
        <button className="ghost small collapse" onClick={() => setMode('none')}>▲ Voltar à revisão</button>
        <InboxCard item={item} refs={refs} onChanged={onChanged} mode="item" startEditing />
      </div>
    )
  }

  return (
    <article className={`card ${busy ? 'busy' : ''}`}>
      <header className="card-head">
        <span className={`badge type-${item.item_type}`}>{ITEM_TYPES[item.item_type] ?? item.item_type}</span>
        <span className={`small ${overdue ? 'error' : 'muted'}`}>
          {fmtDateTime(item.next_review_at)}
          {item.review_rule ? ` · ${RULE_LABEL[item.review_rule] ?? item.review_rule}` : ''}
        </span>
      </header>

      <h3>
        <button className="link-title" onClick={() => setMode('edit')} title="Abrir e editar">{item.title} ✎</button>
      </h3>
      {(item.carry_overs ?? 0) > 0 && (
        <p className="small error">↪ Transitou de dia {item.carry_overs}× sem ser revisto</p>
      )}
      {item.description && item.description !== item.title && <blockquote>{item.description}</blockquote>}

      {[...people, ...groups, ...tags].length > 0 && (
        <div className="chips">
          {[...people, ...groups, ...tags].map((r) => (
            <span key={r.id} className="chip">{r.name}</span>
          ))}
        </div>
      )}
      {linkedEvents.length > 0 && (
        <div className="links">
          <span className="links-label">Eventos</span>
          {linkedEvents.map((e) => <div key={e.id} className="small">📅 {e.title} · {fmtEvent(e)}</div>)}
        </div>
      )}
      <ScopeEditor scopes={item.item_scopes} groups={[]} editing={false} />

      {(isCase || updates.length > 0) && (
        <div className="links">
          <span className="links-label">Acompanhamento · aberto há {daysOpen} {daysOpen === 1 ? 'dia' : 'dias'}</span>
          {updates.length === 0 && <div className="small muted">Ainda sem atualizações.</div>}
          {updates.slice(0, 6).map((u) => (
            <div key={u.id} className="small">
              <b>{fmtDate(u.created_at)}</b> · {TREND_LABELS[u.trend] ?? u.trend} — {u.content}
            </div>
          ))}
        </div>
      )}

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

      {/* Associar a próximo(s) evento(s) */}
      {mode === 'events' && (
        <div className="links stack">
          <span className="links-label">Escolhe o(s) evento(s) — será revisto no dia do último</span>
          {upcoming.length === 0 && <span className="muted small">Não há eventos nos próximos 30 dias.</span>}
          <div className="event-pick">
            {upcoming.map((e) => (
              <label key={e.id} className="inline small">
                <input
                  type="checkbox"
                  checked={picked.includes(e.id)}
                  onChange={(ev) => setPicked(ev.target.checked ? [...picked, e.id] : picked.filter((x) => x !== e.id))}
                />
                {e.title} · {fmtEvent(e)}
              </label>
            ))}
          </div>
          <div className="row">
            <button
              className="primary"
              disabled={!picked.length}
              onClick={() =>
                act(() =>
                  A.reviewToEvents(
                    item.id,
                    picked,
                    picked.map((id) => {
                      const e = refs.events.find((x) => x.id === id)
                      return e ? `${e.title} (${fmtEvent(e)})` : id
                    }),
                    notes,
                  )
                )}
            >
              Associar
            </button>
            <button className="ghost" onClick={() => setMode('none')}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Rever noutro dia */}
      {mode === 'day' && (
        <div className="row" style={{ marginTop: 8 }}>
          <input type="date" value={day} min={localDay(0)} onChange={(e) => setDay(e.target.value)} />
          <button className="primary" disabled={!day} onClick={() => act(() => A.recordReview(item.id, 'ReviewLater', notes, dailyReviewOf(day), 'manual'))}>
            Rever nesse dia (21:30)
          </button>
          <button className="ghost" onClick={() => setMode('none')}>Cancelar</button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {isCase && (
        <footer className="row actions">
          <button disabled={busy} onClick={() => caseStep('same', 'Mantém-se', 'Maintain')}>➖ Mantém-se</button>
          <button disabled={busy} onClick={() => caseStep('better', 'Melhorou', 'Update')}>📈 Melhorou</button>
          <button disabled={busy} onClick={() => caseStep('worse', 'Piorou', 'Update')}>📉 Piorou</button>
          <button className="primary" disabled={busy} onClick={() => caseStep('resolved', 'Já passou', 'Complete')}>
            ✅ Já passou
          </button>
        </footer>
      )}

      <footer className="row actions">
        {!isCase && (
          <button className="primary" disabled={busy} onClick={() => act(() => A.recordReview(item.id, 'Complete', notes, null))}>
            {isKnowledge ? '✓ Guardar como conhecimento' : '✓ Concluir'}
          </button>
        )}
        <button disabled={busy} onClick={() => setMode(mode === 'events' ? 'none' : 'events')}>📅 Associar a evento…</button>
        <button disabled={busy} onClick={() => setMode(mode === 'day' ? 'none' : 'day')}>🗓 Outro dia…</button>
        <button
          disabled={busy}
          onClick={() => act(() => A.recordReview(item.id, notes.trim() ? 'Update' : 'Maintain', notes, nextWeeklyReview(), 'weekly'))}
          title="Sem data própria: vai para a revisão semanal"
        >
          Domingo
        </button>
        <button className="ghost" disabled={busy} onClick={() => act(() => A.recordReview(item.id, 'Archive', notes, null))}>Arquivar</button>
      </footer>
    </article>
  )
}
