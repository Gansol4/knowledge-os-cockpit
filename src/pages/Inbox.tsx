import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InboxItem, Refs } from '../lib/types'
import InboxCard from '../components/InboxCard'

const ITEM_SELECT = `
  id, title, description, item_type, status, classification_status, category, priority, source,
  due_at, occurred_at, created_at, ai_interpretation,
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

export default function Inbox({ email }: { email: string }) {
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
      setItems((data ?? []) as unknown as InboxItem[])
      setRefs(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1>Inbox de Revisão</h1>
          <p className="muted small">
            {items ? `${items.length} ${items.length === 1 ? 'item' : 'itens'} por rever` : 'A carregar…'}
          </p>
        </div>
        <div className="row">
          <button onClick={load}>↻</button>
          <button className="ghost" title={email} onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {items && items.length === 0 && <p className="empty">Tudo revisto. 🎉</p>}

      {items && refs && items.map((item) => <InboxCard key={item.id} item={item} refs={refs} onChanged={load} />)}
    </div>
  )
}
