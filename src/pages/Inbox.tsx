import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InboxItem, Refs } from '../lib/types'
import InboxCard from '../components/InboxCard'

const ITEM_SELECT = `
  id, title, description, item_type, status, classification_status, category, priority, source,
  due_at, occurred_at, next_review_at, created_at, ai_interpretation,
  item_scopes ( id, event_type, group_id, valid_until, groups ( id, name ) ),
  item_people ( people ( id, name ) ),
  item_groups ( groups ( id, name ) ),
  item_tags ( tags ( id, name ) ),
  event_items ( events ( id, title, start_at ) ),
  item_mentions ( id, entity_kind, mention_text, suggested_entity_id, status )
`

async function loadRefs(): Promise<Refs> {
  const now = Date.now()
  const [people, groups, tags, contexts, events] = await Promise.all([
    supabase.from('people').select('id, name, person_type, aliases').eq('active', true).order('name'),
    supabase.from('groups').select('id, name, aliases').eq('active', true).order('name'),
    supabase.from('tags').select('id, name').eq('active', true).order('name'),
    supabase.from('contexts').select('id, name').eq('active', true).order('name'),
    supabase
      .from('events')
      .select('id, title, start_at, all_day')
      .neq('status', 'Cancelled')
      .gte('start_at', new Date(now - 7 * 86_400_000).toISOString())
      .lte('start_at', new Date(now + 30 * 86_400_000).toISOString())
      .order('start_at'),
  ])
  for (const r of [people, groups, tags, contexts, events]) if (r.error) throw new Error(r.error.message)
  return {
    people: people.data ?? [],
    groups: groups.data ?? [],
    tags: tags.data ?? [],
    contexts: contexts.data ?? [],
    events: events.data ?? [],
  } as Refs
}

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
