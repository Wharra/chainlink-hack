import type { Stats } from '../types'

interface Props { stats: Stats | null }

const fmt = (n: number) => n.toLocaleString('en-US')

export default function StatsBar({ stats }: Props) {
  const cards = [
    {
      value: stats ? fmt(stats.analyzed) : null,
      label: 'Contracts analyzed',
      color: 'var(--text-white)',
    },
    {
      value: stats ? fmt(stats.threats) : null,
      label: 'Threats detected',
      color: stats && stats.threats > 0 ? 'var(--red)' : 'var(--text-3)',
    },
    {
      value: stats && stats.value_protected > 0
        ? `$${stats.value_protected.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        : null,
      label: 'Pool value tracked',
      color: 'var(--green)',
      empty: '—',
    },
  ]

  return (
    <div className="stats-grid">
      {cards.map((card) => (
        <div key={card.label} className="stat-card">
          {stats === null ? (
            <>
              <div className="skeleton skeleton-value" style={{ marginBottom: '8px' }} />
              <div className="skeleton skeleton-text" style={{ width: '60%' }} />
            </>
          ) : (
            <>
              <div
                className="stat-value"
                style={{ color: card.value ? card.color : 'var(--text-3)' }}
              >
                {card.value ?? (card.empty ?? '—')}
              </div>
              <div className="stat-label">{card.label}</div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
