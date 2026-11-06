import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { ITEM_SELECT, loadRefs } from '../lib/queries'
import { fmtDate } from '../lib/format'
import { ITEM_STATUSES, ITEM_TYPES, type InboxItem, type Ref, type Refs } from '../lib/types'
import InboxCard from '../components/InboxCard'

type StatusFilter = 'open' | 'Completed' | 'Archived' | 'all'

// Segunda-feira 00:00 (hora local) da semana de uma data
function mondayOf(d: Date): Date {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const dayHeader = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: '2-digit', month: '2-digit' })

export default function Items() {
  const [week, setWeek] = useState<Date | null>(() => mondayOf(new Date())) // null = todas as semanas
  const [status, setStatus] = useState<StatusFilter>('open')
  const [type, setType] = useState('')
  const [personId, setPersonId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [tagId, setTagId] = useState('')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('') // pesquisa aplicada
  const [items, setItems] = useState<InboxItem[] | null>(null)
  const [refs, setRefs] = useState<Refs | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRefs().then(setRefs).catch((e) => setError(String(e)))
  }, [])

  const load = useCallback(async () => {
    setError(null)
    // Aliases "f_*" com !inner servem só para filtrar, sem cortar as listas mostradas no cartão
    let sel = ITEM_SELECT + ', reviews ( result, notes, review_date )'
    if (personId) sel += ', f_people:item_people!inner ( person_id )'
    if (groupId) sel += ', f_groups:item_groups!inner ( group_id )'
    if (tagId) sel += ', f_tags:item_tags!inner ( tag_id )'

    let query = supabase.from('items').select(sel)
    if (week) {
      query = query.gte('created_at', week.toISOString()).lt('created_at', addDays(week, 7).toISOString())
    }
    if (status === 'open') query = query.not('status', 'in', '(Completed,Archived)').neq('classification_status', 'Ignored')
    else if (status !== 'all') query = query.eq('status', status)
    if (type) query = query.eq('item_type', type)
    if (personId) query = query.eq('f_people.person_id', personId)
    if (groupId) query = query.eq('f_groups.group_id', groupId)
    if (tagId) query = query.eq('f_tags.tag_id', tagId)
    const s = q.replace(/[,()%*\\]/g, ' ').trim()
    if (s) query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%`)

    const { data, error } = await query.order('created_at', { ascending: false }).limit(200)
    if (error) return setError(error.message)
    setItems((data ?? []) as unknown as InboxItem[])
  }, [week, status, type, personId, groupId, tagId, q])

  useEffect(() => {
    load()
  }, [load])

  // Agrupar por dia de criação
  const byDay = useMemo(() => {
    const groups: { day: string; items: InboxItem[] }[] = []
    for (const it of items ?? []) {
      const day = dayHeader.format(new Date(it.created_at))
      const last = groups[groups.length - 1]
      if (last && last.day === day) last.items.push(it)
      else groups.push({ day, items: [it] })
    }
    return groups
  }, [items])

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    setQ(search)
  }

  const thisWeek = mondayOf(new Date()).getTime()
  const weekLabel = week
    ? `${week.getTime() === thisWeek ? 'Esta semana · ' : ''}${fmtDate(week.toISOString())} a ${fmtDate(addDays(week, 6).toISOString())}`
    : 'Todas as semanas'

  return (
    <>
      <div className="week-nav">
        <button disabled={!week} onClick={() => week && setWeek(addDays(week, -7))} aria-label="Semana anterior">‹</button>
        <span className="week-label">{weekLabel}</span>
        <button disabled={!week} onClick={() => week && setWeek(addDays(week, 7))} aria-label="Semana seguinte">›</button>
        <button className="ghost" onClick={() => setWeek(week ? null : mondayOf(new Date()))}>
          {week ? 'Todas' : 'Esta semana'}
        </button>
      </div>

      <form className="row filters" onSubmit={submitSearch}>
        <input className="grow" placeholder="Pesquisar (ex: Aquiles, Relvão)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button>🔍</button>
      </form>

      <div className="row filters">
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="open">Abertos</option>
          <option value="Completed">Concluídos</option>
          <option value="Archived">Arquivados</option>
          <option value="all">Todos os estados</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(ITEM_TYPES).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <RefSelect label="Pessoa" value={personId} onChange={setPersonId} options={refs?.people ?? []} />
        <RefSelect label="Grupo" value={groupId} onChange={setGroupId} options={refs?.groups ?? []} />
        <RefSelect label="Tag" value={tagId} onChange={setTagId} options={refs?.tags ?? []} />
      </div>

      <p className="muted small">{items ? `${items.length} ${items.length === 1 ? 'item' : 'itens'}` : 'A carregar…'}</p>
      {error && <p className="error">{error}</p>}
      {items && items.length === 0 && <p className="empty">Nenhum item com estes filtros.</p>}

      {byDay.map((g) => (
        <section key={g.day}>
          <h2 className="section-title">{g.day}</h2>
          {g.items.map((it) =>
            expanded === it.id && refs ? (
              <div key={it.id}>
                <button className="ghost small collapse" onClick={() => setExpanded(null)}>▲ Fechar</button>
                <InboxCard item={it} refs={refs} onChanged={load} mode="item" />
              </div>
            ) : (
              <ItemRow key={it.id} item={it} onOpen={() => setExpanded(it.id)} />
            ),
          )}
        </section>
      ))}
    </>
  )
}

function RefSelect(props: { label: string; value: string; onChange: (v: string) => void; options: Ref[] }) {
  return (
    <select value={props.value} onChange={(e) => props.onChange(e.target.value)}>
      <option value="">{props.label}: todas</option>
      {props.options.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  )
}

function ItemRow({ item, onOpen }: { item: InboxItem; onOpen: () => void }) {
  const names = [
    ...item.item_people.map((x) => x.people?.name),
    ...item.item_groups.map((x) => x.groups?.name),
  ].filter(Boolean)
  return (
    <button className="item-row" onClick={onOpen}>
      <span className={`badge type-${item.item_type}`}>{ITEM_TYPES[item.item_type] ?? item.item_type}</span>
      <span className="item-row-main">
        <span className="item-row-title">{item.title}</span>
        {names.length > 0 && <span className="muted small">{names.join(' · ')}</span>}
      </span>
      <span className="item-row-meta small">
        {item.classification_status === 'PendingValidation' && <span title="Por validar">⚠️</span>}
        {item.status !== 'Open' && <span className="muted">{ITEM_STATUSES[item.status] ?? item.status}</span>}
        {item.next_review_at && <span className="muted" title="Próxima revisão">🔁 {fmtDate(item.next_review_at)}</span>}
      </span>
    </button>
  )
}
