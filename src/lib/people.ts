// Leitura e escrita de pessoas (separador Pessoas)
import { supabase } from './supabase'

export type PersonRow = {
  id: string
  name: string
  person_type: string
  main_context_id: string
  email: string | null
  phone: string | null
  notes: string | null
  active: boolean
  aliases: string[]
  group_people: { groups: { id: string; name: string } | null }[]
}

export type AthleteRow = {
  id: string
  person_id: string
  position: string | null
  current_restrictions: string | null
  development_goals: string | null
  problematic_exercises: string | null
}

export type PersonHistory = {
  items: { id: string; title: string; item_type: string; status: string; created_at: string }[]
  events: { id: string; title: string; start_at: string; all_day: boolean; status: string }[]
}

async function run<T>(p: PromiseLike<{ error: { message: string } | null; data?: T }>): Promise<T | undefined> {
  const { error, data } = await p
  if (error) throw new Error(error.message)
  return data
}

const PERSON_SELECT = 'id, name, person_type, main_context_id, email, phone, notes, active, aliases, group_people ( groups ( id, name ) )'

export async function listPeople(): Promise<PersonRow[]> {
  const data = await run(supabase.from('people').select(PERSON_SELECT).order('name'))
  return (data ?? []) as unknown as PersonRow[]
}

export async function loadAthlete(personId: string): Promise<AthleteRow | null> {
  const data = await run(supabase.from('athletes').select('*').eq('person_id', personId).maybeSingle())
  return (data as AthleteRow | null) ?? null
}

export async function loadHistory(personId: string): Promise<PersonHistory> {
  const [items, events] = await Promise.all([
    run(
      supabase
        .from('item_people')
        .select('items ( id, title, item_type, status, created_at )')
        .eq('person_id', personId),
    ),
    run(
      supabase
        .from('event_people')
        .select('events ( id, title, start_at, all_day, status )')
        .eq('person_id', personId),
    ),
  ])

  const its = ((items ?? []) as any[]).map((x) => x.items).filter(Boolean)

  const evs = ((events ?? []) as any[]).map((x) => x.events).filter(Boolean)
  its.sort((a, b) => b.created_at.localeCompare(a.created_at))
  evs.sort((a, b) => b.start_at.localeCompare(a.start_at))
  return { items: its, events: evs }
}

export function updatePerson(
  id: string,
  fields: Partial<Pick<PersonRow, 'name' | 'person_type' | 'main_context_id' | 'email' | 'phone' | 'notes' | 'active' | 'aliases'>>,
) {
  return run(supabase.from('people').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id))
}

export async function createPerson(p: { name: string; person_type: string; main_context_id: string }): Promise<string> {
  const data = await run(supabase.from('people').insert({ ...p, name: p.name.trim() }).select('id').single())
  const id = (data as unknown as { id: string } | null)?.id
  if (!id) throw new Error('Não foi possível criar a pessoa')
  return id
}

export function addToGroup(personId: string, groupId: string) {
  return run(
    supabase
      .from('group_people')
      .upsert({ person_id: personId, group_id: groupId }, { onConflict: 'group_id,person_id', ignoreDuplicates: true }),
  )
}

export function removeFromGroup(personId: string, groupId: string) {
  return run(supabase.from('group_people').delete().eq('person_id', personId).eq('group_id', groupId))
}

// A tabela athletes não tem chave única em person_id: atualiza se existir, senão cria
export async function saveAthlete(personId: string, fields: Omit<AthleteRow, 'id' | 'person_id'>) {
  const existing = await loadAthlete(personId)
  const now = new Date().toISOString()
  if (existing) return run(supabase.from('athletes').update({ ...fields, updated_at: now }).eq('id', existing.id))
  return run(supabase.from('athletes').insert({ person_id: personId, ...fields }))
}
