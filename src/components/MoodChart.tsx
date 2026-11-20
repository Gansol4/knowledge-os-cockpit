import { useRef, useState } from 'react'

// Energia e estado (1–5) ao longo dos dias. Um só eixo (mesma escala), 2 séries, legenda + rótulo no fim,
// dias sem entrada interrompem a linha. Passar o rato/dedo mostra o dia (linha vertical + valores).
export type DayPoint = { day: string; energy: number | null; mood: number | null }

const SERIES = [
  { key: 'energy' as const, label: 'Energia', cls: 's1' },
  { key: 'mood' as const, label: 'Estado', cls: 's2' },
]

const W = 640
const H = 220
const M = { top: 12, right: 64, bottom: 28, left: 28 }
const fmtDay = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit' })
const fmtLong = new Intl.DateTimeFormat('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' })

export default function MoodChart({ points }: { points: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const n = points.length
  const iw = W - M.left - M.right
  const ih = H - M.top - M.bottom
  const x = (i: number) => M.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => M.top + ih - ((v - 1) / 4) * ih

  // Segmentos contínuos (um dia sem valor parte a linha)
  function paths(key: 'energy' | 'mood') {
    const out: string[] = []
    let cur = ''
    points.forEach((p, i) => {
      const v = p[key]
      if (v == null) {
        if (cur) out.push(cur)
        cur = ''
        return
      }
      cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    })
    if (cur) out.push(cur)
    return out
  }

  function lastIndex(key: 'energy' | 'mood') {
    for (let i = n - 1; i >= 0; i--) if (points[i][key] != null) return i
    return -1
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = ref.current?.getBoundingClientRect()
    if (!r || n === 0) return
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - M.left) / iw) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0]
  const h = hover != null ? points[hover] : null

  return (
    <div className="chart">
      <div className="legend small">
        {SERIES.map((s) => (
          <span key={s.key} className="legend-item">
            <span className={`swatch ${s.cls}`} /> {s.label}
          </span>
        ))}
        <span className="muted">· 1 = muito baixo, 5 = muito alto</span>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Energia e estado por dia"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line className="grid" x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} />
            <text className="axis" x={M.left - 8} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        {ticks.map((i) => (
          <text key={i} className="axis" x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
            {fmtDay.format(new Date(points[i].day + 'T12:00:00'))}
          </text>
        ))}
        {hover != null && <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} />}
        {SERIES.map((s) => (
          <g key={s.key} className={s.cls}>
            {paths(s.key).map((d, i) => <path key={i} d={d} className="line" />)}
            {points.map((p, i) =>
              p[s.key] != null ? (
                <circle key={i} cx={x(i)} cy={y(p[s.key]!)} r={hover === i ? 5 : 4} className="dot" />
              ) : null
            )}
            {lastIndex(s.key) >= 0 && (
              <text className="direct" x={x(lastIndex(s.key)) + 10} y={y(points[lastIndex(s.key)][s.key]!) + (s.key === 'energy' ? -4 : 12)}>
                {s.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {h && (
        <div className="tooltip small">
          <b>{fmtLong.format(new Date(h.day + 'T12:00:00'))}</b>
          {h.energy == null && h.mood == null ? (
            <span className="muted"> · sem entrada</span>
          ) : (
            <>
              {SERIES.map((s) => (
                <span key={s.key}>
                  {' '}· <span className={`swatch ${s.cls}`} /> {s.label} {h[s.key] ?? '–'}
                </span>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
