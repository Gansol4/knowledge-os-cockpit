export type Ref = { id: string; name: string }
export type PersonRef = Ref & { person_type: string; aliases: string[] }
export type GroupRef = Ref & { aliases: string[] }
export type EventRef = { id: string; title: string; start_at: string; all_day: boolean }

export type Mention = {
  id: string
  entity_kind: 'person' | 'group' | 'event'
  mention_text: string
  suggested_entity_id: string | null
  status: 'pending' | 'resolved' | 'ignored'
}

export type InboxItem = {
  id: string
  title: string
  description: string | null
  item_type: string
  status: string
  classification_status: string
  category: string | null
  priority: string | null
  source: string
  due_at: string | null
  occurred_at: string | null
  created_at: string
  ai_interpretation: { confidence?: string; confidence_reason?: string } | null
  item_people: { people: Ref | null }[]
  item_groups: { groups: Ref | null }[]
  item_tags: { tags: Ref | null }[]
  event_items: { events: { id: string; title: string; start_at: string } | null }[]
  item_mentions: Mention[]
}

export type Refs = {
  people: PersonRef[]
  groups: GroupRef[]
  tags: Ref[]
  contexts: Ref[]
  events: EventRef[]
}

export const ITEM_TYPES: Record<string, string> = {
  Observation: 'Observação',
  Task: 'Tarefa',
  Goal: 'Objetivo',
  Conversation: 'Conversa',
  Decision: 'Decisão',
  Idea: 'Ideia',
  Learning: 'Aprendizagem',
  Reference: 'Referência',
}

export const PERSON_TYPES: Record<string, string> = {
  Athlete: 'Atleta',
  Staff: 'Staff',
  Student: 'Aluno',
  Family: 'Família',
  Contact: 'Contacto',
}

export const KIND_LABEL: Record<Mention['entity_kind'], string> = {
  person: 'Pessoa',
  group: 'Grupo',
  event: 'Evento',
}
