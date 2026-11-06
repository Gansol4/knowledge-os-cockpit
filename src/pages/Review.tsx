import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ReviewItem } from '../lib/types'
import ReviewCard from '../components/ReviewCard'
import { fmtDateTime } from '../lib/format'

const REVIEW_SELECT = `
  id, title, description, item_type, status, classification_status, category, priority, source,
  due_at, occurred_at, next_review_at, created_at, ai_interpretation,
  item_people ( people ( id, name ) ),
  item_groups ( groups ( id, name ) ),
  item_tags ( tags ( id, name ) ),
  item_scopes ( id, event_type, group_id, valid_until, groups ( id, name ) ),
  reviews ( result, notes, review_date )
`

export default function Review({ onCount }: { onCount: (n: number) => void }) {
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const in7 = new Date()
    in7.setDate(in7.getDate() + 7)
    in7.setHours(23, 59, 59, 999)
    const { data, error } = await supabase
      .from('items')
      .select(REVIEW_SELECT)
      .not('next_review_at', 'is', null)
      .lte('next_review_at', in7.toISOString())
      .not('status', 'in', '(Completed,Archived)')
      .neq('classification_status', 'Ignored')
      .order('next_review_at')
    if (error) return setError(error.message)
    setItems((data ?? []) as unknown as ReviewItem[])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const endOfToday = new Date(new Date().setHours(23, 59, 59, 999))
  const due = (items ?? []).filter((i) => new Date(i.next_review_at!) <= endOfToday)
  const upcoming = (items ?? []).filter((i) => new Date(i.next_review_at!) > endOfToday)

  useEffect(() => {
    if (items) onCount(due.length)
  }, [items, due.length, onCount])

  return (
    <>
      <div className="top">
        <p className="muted small">
          {items ? `${due.length} para rever hoje · ${upcoming.length} nos próximos 7 dias` : 'A carregar…'}
        </p>
        <button onClick={load}>↻</button>
      </div>

      {error && <p className="error">{error}</p>}
      {items && due.length === 0 && <p className="empty">Nada para rever hoje. 🎉</p>}

      {due.map((item) => <ReviewCard key={item.id} item={item} onChanged={load} />)}

      {upcoming.length > 0 && (
        <section>
          <h2 className="section-title">Próximos 7 dias</h2>
          {upcoming.map((i) => (
            <div key={i.id} className="list-row">
              <span>{i.title}</span>
              <span className="muted small">{fmtDateTime(i.next_review_at)}</span>
            </div>
          ))}
        </section>
      )}
    </>
  )
}
