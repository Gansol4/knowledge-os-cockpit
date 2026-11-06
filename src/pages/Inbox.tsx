import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InboxItem, Refs } from '../lib/types'
import { ITEM_SELECT, loadRefs } from '../lib/queries'
import InboxCard from '../components/InboxCard'

export default function Inbox({ onCount }: { onCount: (n: number) => void }) {
  const [items, setItems] = useState<InboxItem[] | null>(null)
  const [refs, setRefs] = useState<Refs | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data, error }, r] = await Promise.all([
        supabase
          .from('items')
          .select(ITEM_SELECT)
          .eq('classification_status', 'PendingValidation')
          .order('created_at', { ascending: false }),
        loadRefs(),
      ])
      if (error) throw new Error(error.message)
      const list = (data ?? []) as unknown as InboxItem[]
      setItems(list)
      setRefs(r)
      onCount(list.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [onCount])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <div className="top">
        <p className="muted small">
          {items ? `${items.length} ${items.length === 1 ? 'item' : 'itens'} por validar` : 'A carregar…'}
        </p>
        <button onClick={load}>↻</button>
      </div>

      {error && <p className="error">{error}</p>}

      {items && items.length === 0 && <p className="empty">Tudo validado. 🎉</p>}

      {items && refs && items.map((item) => <InboxCard key={item.id} item={item} refs={refs} onChanged={load} />)}
    </>
  )
}
