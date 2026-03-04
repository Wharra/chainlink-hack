import { useState } from 'react'
import { Zap } from 'lucide-react'
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

function fmtDate(unix: number): string {
  const d = new Date(unix * 1000)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TYPES = ['All', 'Honeypot', 'Rug Pull', 'Backdoor', 'Fund Drain', 'Unltd. Mint', 'Access Ctrl', 'Hidden Tax', 'Clean']

export default function HistoryPage({ alerts, loading }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const filtered = alerts.filter(a => {
    const addr = extractAddress(a.contract).toLowerCase()
    const badge = vulnBadge(a.vulnerability)
    const matchSearch = !search || addr.includes(search.toLowerCase())
    const matchFilter = filter === 'All' || badge.label === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="history-page">
      {/* Page header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 className="page-title">Alert History</h2>
        <p className="page-subtitle">Every contract ChainGuard has scanned and flagged.</p>
      </div>

      {/* Toolbar */}
      <div className="history-toolbar">
        <input
          type="text"
          placeholder="Search by address"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />

        <div className="pill-group">
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`pill ${filter === t ? 'active' : ''}`}
            >
              {t}
            </button>
          ))}
        </div>

        <span className="results-count">
          {loading ? 'Syncing…' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Table */}
      <div className="card">
        {filtered.length === 0 ? (
          <div className="table-empty">No results</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {['#', 'Date', 'Address', 'Score', 'Vulnerability', 'Chain', 'Status'].map(h => (
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
                  >
                    <td className="text-3" style={{ width: '40px', fontSize: '12px' }}>
                      {filtered.length - i}
                    </td>
                    <td className="text-2" style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {fmtDate(alert.time)}
                    </td>
                    <td>
                      <a
                        href={`https://etherscan.io/address/${addr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="addr-link"
                        title={addr}
                      >
                        {addr.slice(0, 10)}…{addr.slice(-8)}
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
                          <span className="badge-exploit" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Zap size={10} /> EXPLOIT
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="badge-chain">{alert.chain}</span>
                    </td>
                    <td>
                      <span
                        className="mono"
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: alert.status === 'PENDING' ? 'var(--amber)' : 'var(--text-3)',
                        }}
                      >
                        {alert.status}
                      </span>
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
