import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ITEM_SELECT, loadRefs } from '../lib/queries'
import type { Refs, ReviewItem } from '../lib/types'
import ReviewCard from '../components/ReviewCard'
import { fmtDateTime } from '../lib/format'

const REVIEW_SELECT = `${ITEM_SELECT}, reviews ( result, notes, review_date )`

export default function Review({ onCount }: { onCount: (n: number) => void }) {
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [refs, setRefs] = useState<Refs | null>(null)
  const [openId, setOpenId] = useState<string | null>(null) // item dos próximos dias aberto
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const in7 = new Date()
    in7.setDate(in7.getDate() + 7)
    in7.setHours(23, 59, 59, 999)
    try {
      const [{ data, error }, r] = await Promise.all([
        supabase
          .from('items')
          .select(REVIEW_SELECT)
          .not('next_review_at', 'is', null)
          .lte('next_review_at', in7.toISOString())
          .not('status', 'in', '(Completed,Archived)')
          .neq('classification_status', 'Ignored')
          .order('next_review_at'),
        loadRefs(),
      ])
      if (error) throw new Error(error.message)
      setItems((data ?? []) as unknown as ReviewItem[])
      setRefs(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
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

      {refs && due.map((item) => <ReviewCard key={item.id} item={item} refs={refs} onChanged={load} />)}

      {upcoming.length > 0 && refs && (
        <section>
          <h2 className="section-title">Próximos 7 dias</h2>
          {upcoming.map((i) =>
            openId === i.id ? (
              <div key={i.id}>
                <button className="ghost small collapse" onClick={() => setOpenId(null)}>▲ Fechar</button>
                <ReviewCard item={i} refs={refs} onChanged={load} />
              </div>
            ) : (
              <button key={i.id} className="item-row" onClick={() => setOpenId(i.id)}>
                <span className="item-row-main">
                  <span className="item-row-title">{i.title}</span>
                </span>
                <span className="item-row-meta small muted">{fmtDateTime(i.next_review_at)}</span>
              </button>
            ),
          )}
        </section>
      )}
    </>
  )
}
