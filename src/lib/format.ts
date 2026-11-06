const dateTime = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Europe/Lisbon',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const dateOnlyUtc = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'UTC',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
})

const dateOnly = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Europe/Lisbon',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
})

export function fmtDate(iso: string | null): string {
  return iso ? dateOnly.format(new Date(iso)) : ''
}

// Valor para <input type="datetime-local"> (hora local do dispositivo)
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null
}

// Próxima revisão semanal: domingo às 09:00 (hora local).
// Se hoje é domingo, salta para o domingo seguinte (a revisão de hoje está a ser feita agora).
export function nextSundayAt9(): string {
  const d = new Date()
  const add = d.getDay() === 0 ? 7 : 7 - d.getDay()
  d.setDate(d.getDate() + add)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

// Daqui a N dias, às 09:00 (hora local)
export function inDaysAt9(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

export function fmtDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : ''
}

export function fmtEvent(e: { start_at: string; all_day?: boolean }): string {
  return e.all_day ? dateOnlyUtc.format(new Date(e.start_at)) : dateTime.format(new Date(e.start_at))
}
