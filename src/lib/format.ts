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

export function fmtDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : ''
}

export function fmtEvent(e: { start_at: string; all_day?: boolean }): string {
  return e.all_day ? dateOnlyUtc.format(new Date(e.start_at)) : dateTime.format(new Date(e.start_at))
}
