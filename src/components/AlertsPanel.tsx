import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDateTime } from '../lib/format'
import { recordReview } from '../lib/actions'

type Alert = {
  id: string; created_at: string; updated_at: string; alert_type: string; severity: string; title: string; status: string
  details: { item_ids?: string[] } | null
}

const TYPE_LABEL: Record<string, string> = {
  athlete_recurrence: 'Recorrência',
  athlete_silence: 'Sem registos',
  review_backlog: 'Revisões acumuladas',
  system_failure: 'Sistema',
  case_persistent: 'Caso persistente',
}

export const OPEN_ALERT_STATUSES = ['new', 'sent', 'seen']

// Alertas abertos (nota 26). Resolvido = tratado; Ignorar = não era relevante.
// Os de recorrência e silêncio também se resolvem sozinhos (novo registo, ou fim da janela de 10 dias).
export default function AlertsPanel({ onCount }: { onCount?: (n: number) => void }) {
  const [alerts, setAlerts] = useState<Alert[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('alerts')
      .select('id, created_at, updated_at, alert_type, severity, title, status, details')
      .in('status', OPEN_ALERT_STATUSES)
      .order('severity')
      .order('updated_at', { ascending: false })
    if (error) setError(error.message)
    else {
      setAlerts((data ?? []) as Alert[])
      onCount?.((data ?? []).length)
    }
  }, [onCount])

  useEffect(() => {
    load()
  }, [load])

  async function close(id: string, status: 'resolved' | 'dismissed') {
    const { error } = await supabase
      .from('alerts')
      .update({ status, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  // Recorrência resolvida ("já não sente"): conclui os registos do alerta → saem dos próximos briefings
  async function resolveWithItems(a: Alert) {
    try {
      for (const id of a.details?.item_ids ?? []) {
        await recordReview(id, 'Complete', 'Resolvido a partir do alerta', null)
      }
      await close(a.id, 'resolved')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (error) return <p className="error">Alertas: {error}</p>
  if (!alerts || alerts.length === 0) return null

  return (
    <section className="alerts">
      <h2 className="section-title">⚠️ Alertas</h2>
      {alerts.map((a) => (
        <div key={a.id} className={`alert alert-${a.severity}`}>
          <div className="alert-main">
            <span className="small muted">
              {a.severity === 'high' ? '🔴' : '🟡'} {TYPE_LABEL[a.alert_type] ?? a.alert_type} · {fmtDateTime(a.updated_at)}
            </span>
            <span>{a.title}</span>
          </div>
          <div className="row">
            {['athlete_recurrence', 'case_persistent'].includes(a.alert_type) && (a.details?.item_ids?.length ?? 0) > 0 ? (
              <button
                className="small"
                title="Conclui os registos deste alerta: deixam de aparecer nos briefings (o histórico fica)"
                onClick={() => resolveWithItems(a)}
              >
                ✓ Já passou (concluir {a.details!.item_ids!.length} registos)
              </button>
            ) : (
              <button className="small" onClick={() => close(a.id, 'resolved')}>✓ Resolvido</button>
            )}
            <button className="ghost small" onClick={() => close(a.id, 'dismissed')}>Ignorar</button>
          </div>
        </div>
      ))}
    </section>
  )
}
