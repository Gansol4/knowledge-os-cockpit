import { supabase } from './supabase'
import type { Refs } from './types'

// Campos de um item com todas as ligações (usado na Inbox e na lista de Itens)
export const ITEM_SELECT = `
  id, title, description, item_type, status, classification_status, category, priority, source,
  due_at, occurred_at, next_review_at, review_rule, carry_overs, created_at, ai_interpretation,
  item_scopes ( id, event_type, group_id, valid_until, groups ( id, name ) ),
  item_people ( people ( id, name ) ),
  item_groups ( groups ( id, name ) ),
  item_tags ( tags ( id, name ) ),
  event_items ( events ( id, title, start_at ) ),
  item_mentions ( id, entity_kind, mention_text, suggested_entity_id, status ),
  item_updates ( id, created_at, content, trend )
`

// Listas de referência para os seletores (pessoas, grupos, tags, contextos, eventos próximos)
export async function loadRefs(): Promise<Refs> {
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
