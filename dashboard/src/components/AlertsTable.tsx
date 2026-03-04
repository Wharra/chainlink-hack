import { useState } from 'react'
import type { Alert } from '../types'

interface Props { alerts: Alert[]; loading: boolean }

function extractAddress(contract: string): string {
  const parts = contract.split('_')
  if (parts.length < 2) return contract
  return parts[1].replace('.sol', '').replace('.json', '')
}

type Badge = { label: string; cls: string }
function vulnBadge(vuln: string): Badge {
  const v = vuln.toLowerCase()
  if (v.includes('honeypot')) return { label: 'Honeypot', cls: 'badge-red' }
  if (v.includes('rug')) return { label: 'Rug Pull', cls: 'badge-orange' }
  if (v.includes('backdoor')) return { label: 'Backdoor', cls: 'badge-red' }
  if (v.includes('drain')) return { label: 'Fund Drain', cls: 'badge-red' }
  if (v.includes('mint')) return { label: 'Unltd. Mint', cls: 'badge-amber' }
  if (v.includes('access') || v.includes('control')) return { label: 'Access Ctrl', cls: 'badge-amber' }
  if (v.includes('tax') || v.includes('fee')) return { label: 'Hidden Tax', cls: 'badge-purple' }
  if (v.includes('no significant') || v.includes('safe') || v === 'none')
    return { label: 'Clean', cls: 'badge-green' }
  return { label: vuln.slice(0, 22), cls: 'badge-amber' }
}

function scoreClass(score: number | undefined): string {
  if (score === undefined) return 'text-3'
  if (score >= 85) return 'score-critical'
  if (score >= 70) return 'score-high'
  if (score >= 50) return 'score-medium'
  return 'score-low'
}

function timeAgo(unix: number): string {
  const d = Math.floor(Date.now() / 1000 - unix)
  if (d < 60) return `${d}s ago`
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

type Filter = 'all' | 'threat' | 'safe'

export default function AlertsTable({ alerts, loading }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const threats = alerts.filter(a => (a.score ?? 0) >= 85 || (a.status === 'THREAT'))
  const filtered = filter === 'threat'
    ? threats
    : filter === 'safe'
      ? alerts.filter(a => (a.score ?? 0) < 50)
      : alerts

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="card-title">Live Pool Scan</span>
          {alerts.length > 0 && (
            <span className="badge-count">{alerts.length}</span>
          )}
          {threats.length > 0 && (
            <span className="badge badge-red">
              {threats.length} THREAT{threats.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="filter-group">
            {(['all', 'threat', 'safe'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`filter-btn ${filter === f
                    ? f === 'threat' ? 'active-threat'
                      : f === 'safe' ? 'active-safe'
                        : 'active'
                    : ''
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="sync-indicator">
            <div className={`sync-dot ${loading ? 'syncing' : 'online'}`} />
            <span className="sync-label">{loading ? 'SYNCING' : '5s REFRESH'}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="table-empty">
            {alerts.length === 0 ? 'No pools detected yet' : 'No results for this filter'}
            <div className="table-empty-sub">Monitoring Uniswap V3 + V4 pools</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {['Time', 'Contract', 'Score', 'Threat', 'Pool value', 'Network'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((alert, i) => {
                const addr = extractAddress(alert.contract)
                const badge = vulnBadge(alert.vulnerability)
                const sc = alert.score
                const isHigh = (sc ?? 0) >= 85

                return (
                  <tr
                    key={alert.output_name || i}
                    className={isHigh ? 'table-row-threat' : ''}
                    style={i === 0 ? { animation: 'fade-in 0.3s ease' } : undefined}
                  >
                    <td className="mono text-3" style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {timeAgo(alert.time)}
                    </td>
                    <td>
                      <a
                        href={`https://etherscan.io/address/${addr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="addr-link"
                      >
                        {addr.slice(0, 8)}…{addr.slice(-6)}
                      </a>
                    </td>
                    <td>
                      {sc !== undefined ? (
                        <span className={`score ${scoreClass(sc)}`}>{sc}</span>
                      ) : (
                        <span className="text-3">—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`badge ${badge.cls}`}>{badge.label}</span>
                        {alert.exploit_confirmed && (
                          <span className="badge-exploit">⚡ EXPLOIT</span>
                        )}
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: '12px' }}>
                      {alert.value_usd > 0
                        ? <span className="text-2">${alert.value_usd.toFixed(2)}</span>
                        : <span className="text-3" style={{ fontSize: '11px' }}>New pool</span>
                      }
                    </td>
                    <td>
                      <span className="badge-chain">{alert.chain}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
