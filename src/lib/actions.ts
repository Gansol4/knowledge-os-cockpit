// Todas as escritas na base de dados feitas pelo Cockpit.
import { supabase } from './supabase'
import type { InboxItem, Mention, Refs } from './types'

async function run<T>(p: PromiseLike<{ error: { message: string } | null; data?: T }>): Promise<T | undefined> {
  const { error, data } = await p
  if (error) throw new Error(error.message)
  return data
}

const now = () => new Date().toISOString()

// ---------- Item ----------

export function confirmItem(id: string) {
  return run(supabase.from('items').update({ classification_status: 'Classified', updated_at: now() }).eq('id', id))
}

export function ignoreItem(id: string) {
  return run(
    supabase
      .from('items')
      .update({ classification_status: 'Ignored', status: 'Archived', updated_at: now() })
      .eq('id', id),
  )
}

export function updateItem(
  id: string,
  fields: Partial<Pick<InboxItem, 'title' | 'item_type' | 'due_at' | 'next_review_at' | 'status'>>,
) {
  return run(supabase.from('items').update({ ...fields, updated_at: now() }).eq('id', id))
}

// ---------- Ligações ----------

type LinkKind = 'person' | 'group' | 'tag' | 'event'

const LINK: Record<LinkKind, { table: string; col: string; extra?: Record<string, string> }> = {
  person: { table: 'item_people', col: 'person_id' },
  group: { table: 'item_groups', col: 'group_id' },
  tag: { table: 'item_tags', col: 'tag_id' },
  event: { table: 'event_items', col: 'event_id', extra: { link_source: 'user' } },
}

export function addLink(kind: LinkKind, itemId: string, entityId: string) {
  const { table, col, extra } = LINK[kind]
  return run(
    supabase
      .from(table)
      .upsert({ item_id: itemId, [col]: entityId, ...extra }, { onConflict: `item_id,${col}`, ignoreDuplicates: true }),
  )
}

export function removeLink(kind: LinkKind, itemId: string, entityId: string) {
  const { table, col } = LINK[kind]
  return run(supabase.from(table).delete().eq('item_id', itemId).eq(col, entityId))
}

export async function addNewTag(itemId: string, name: string) {
  const clean = name.trim()
  if (!clean) return
  const { data: existing } = await supabase.from('tags').select('id').ilike('name', clean).maybeSingle()
  let tagId = existing?.id as string | undefined
  if (!tagId) {
    const created = await run(supabase.from('tags').insert({ name: clean, created_by: 'user' }).select('id').single())
    tagId = (created as { id: string } | undefined)?.id
  }
  if (tagId) await addLink('tag', itemId, tagId)
}

// ---------- Âmbito ("em todos os treinos até…") ----------

export function addScope(
  itemId: string,
  scope: { event_type: string | null; group_id: string | null; valid_until: string | null },
) {
  return run(supabase.from('item_scopes').insert({ item_id: itemId, ...scope, source: 'user' }))
}

export function removeScope(scopeId: string) {
  return run(supabase.from('item_scopes').delete().eq('id', scopeId))
}

// ---------- Revisões ----------

export type ReviewResult = 'Maintain' | 'Update' | 'Complete' | 'Archive' | 'ReviewLater'

// Regista a decisão no histórico (tabela reviews) e atualiza o estado atual do item.
export async function recordReview(itemId: string, result: ReviewResult, notes: string, nextReviewAt: string | null) {
  const closing = result === 'Complete' || result === 'Archive'
  const next = closing ? null : nextReviewAt

  await run(
    supabase.from('reviews').insert({
      item_id: itemId,
      review_type: 'Custom',
      review_date: now(),
      result,
      notes: notes.trim() || null,
      next_review_at: next,
    }),
  )

  const fields: Record<string, unknown> = { next_review_at: next, updated_at: now() }
  if (result === 'Complete') fields.status = 'Completed'
  if (result === 'Archive') fields.status = 'Archived'
  await run(supabase.from('items').update(fields).eq('id', itemId))

  // Item fechado: as regras de âmbito deixam de se aplicar a partir de agora
  if (closing) {
    const t = now()
    await run(
      supabase.from('item_scopes').update({ valid_until: t }).eq('item_id', itemId).or(`valid_until.is.null,valid_until.gt.${t}`),
    )
  }
}

// ---------- Menções por resolver ----------

// Ligar a uma entidade existente; para pessoas e grupos, guarda o texto como alias
// para a IA reconhecer da próxima vez.
export async function resolveMention(m: Mention, itemId: string, entityId: string, refs: Refs) {
  await addLink(m.entity_kind, itemId, entityId)

  if (m.entity_kind !== 'event') {
    const list = m.entity_kind === 'person' ? refs.people : refs.groups
    const entity = list.find((e) => e.id === entityId)
    const text = m.mention_text.trim()
    const already = entity && (entity.name.toLowerCase() === text.toLowerCase() ||
      entity.aliases.some((a) => a.toLowerCase() === text.toLowerCase()))
    if (entity && !already) {
      await run(
        supabase
          .from(m.entity_kind === 'person' ? 'people' : 'groups')
          .update({ aliases: [...entity.aliases, text] })
          .eq('id', entityId),
      )
    }
  }

  await run(
    supabase.from('item_mentions').update({ status: 'resolved', resolved_entity_id: entityId }).eq('id', m.id),
  )
}

export async function createPersonFromMention(
  m: Mention,
  itemId: string,
  person: { name: string; person_type: string; main_context_id: string },
) {
  const text = m.mention_text.trim()
  const aliases = text.toLowerCase() !== person.name.trim().toLowerCase() ? [text] : []
  const created = await run(
    supabase
      .from('people')
      .insert({ name: person.name.trim(), person_type: person.person_type, main_context_id: person.main_context_id, aliases })
      .select('id')
      .single(),
  )
  const id = (created as { id: string } | undefined)?.id
  if (!id) throw new Error('Não foi possível criar a pessoa')
  await addLink('person', itemId, id)
  await run(supabase.from('item_mentions').update({ status: 'resolved', resolved_entity_id: id }).eq('id', m.id))
}

export function ignoreMention(m: Mention) {
  return run(supabase.from('item_mentions').update({ status: 'ignored' }).eq('id', m.id))
}
