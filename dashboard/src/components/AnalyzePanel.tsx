import { useState, useRef, useEffect } from 'react'
import { runAnalysis } from '../api'
import type { AnalyzeResult } from '../types'

// Known contracts — vulnerabilities discovered live by Antigravity (no preloaded fixtures)
const DEMO_SAFE_ADDR  = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' // WETH — safe reference
const DEMO_VULN_ADDR  = '0x4e2Bf022a5E5c91C4dc64d0D53680C8A862e81BD' // Known honeypot

function scoreColor(s: number) {
  if (s >= 85) return 'var(--red)'
  if (s >= 70) return 'var(--orange)'
  if (s >= 50) return 'var(--amber)'
  return 'var(--green)'
}

function scoreLabel(s: number) {
  if (s >= 85) return 'CRITICAL'
  if (s >= 70) return 'HIGH'
  if (s >= 50) return 'MEDIUM'
  return 'LOW'
}

export default function AnalyzePanel() {
  const [address, setAddress]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [result,  setResult]    = useState<AnalyzeResult | null>(null)
  const [error,   setError]     = useState<string | null>(null)
  const [lines,   setLines]     = useState<string[]>([])
  const terminalRef = useRef<HTMLPreElement>(null)
  const cancelRef   = useRef<(() => void) | null>(null)

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(address.trim())

  // Auto-scroll terminal to bottom as new lines arrive
  useEffect(() => {
    if (terminalRef.current)
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [lines])

  const startScan = (addr: string) => {
    if (cancelRef.current) cancelRef.current()
    setAddress(addr)
    setLoading(true)
    setResult(null)
    setError(null)
    setLines([`$ antigravity --address ${addr} --exploit --json`, ''])
    cancelRef.current = runAnalysis(
      addr,
      (line) => setLines(prev => [...prev, line]),
      (res)  => setResult(res),
      (err)  => setError(err),
      ()     => setLoading(false),
    )
  }

  const handleAnalyze = () => { if (isValid) startScan(address.trim()) }
  const handleDemo = (type: 'safe' | 'vuln') =>
    startScan(type === 'vuln' ? DEMO_VULN_ADDR : DEMO_SAFE_ADDR)

  return (
    <div className="card">
      <div className="card-header">
        <div><div className="card-title">Analyze</div></div>
        <div className="card-subtitle">Antigravity scoring</div>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Demo buttons — trigger real Antigravity scans */}
        <div className="demo-box">
          <div className="demo-label">DEMO</div>
          <div className="demo-buttons">
            <button onClick={() => handleDemo('safe')} disabled={loading} className="demo-btn demo-btn-safe">
              ✓ Safe
            </button>
            <button onClick={() => handleDemo('vuln')} disabled={loading} className="demo-btn demo-btn-vuln">
              ✕ Honeypot
            </button>
          </div>
        </div>

        {/* Address input */}
        <div className="input-row">
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            placeholder="0x contract address"
            className={`input-address ${address && !isValid ? 'invalid' : ''}`}
          />
          <button onClick={handleAnalyze} disabled={!isValid || loading} className="btn-scan">
            {loading ? '…' : 'SCAN'}
          </button>
        </div>

        {/* Live Antigravity terminal */}
        {lines.length > 0 && (
          <div className="exploit-terminal">
            <div className="exploit-terminal-header">
              {loading
                ? <><div className="spinner" style={{ width: 8, height: 8, marginRight: 6 }} /><div className="exploit-terminal-dot" style={{ background: 'var(--amber)' }} />ANTIGRAVITY — SCANNING<span className="mono" style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-3)' }}>~15–30s</span></>
                : <><div className="exploit-terminal-dot" style={{ background: 'var(--green)' }} />ANTIGRAVITY — DONE</>
              }
            </div>
            <pre className="exploit-terminal-output" ref={terminalRef}>
              {lines.join('\n')}
            </pre>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}

        {result && !loading && (() => {
          const c = scoreColor(result.score)
          return (
            <div className="result-card" style={{ border: `1px solid ${c}30` }}>
              <div className="result-score-section" style={{ background: `${c}08` }}>
                <div>
                  <div className="result-score-value" style={{ color: c }}>
                    {result.score}<span className="result-score-max">/100</span>
                  </div>
                  <div className="result-risk-label" style={{ color: c }}>
                    {scoreLabel(result.score)} RISK
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <div className="result-icon" style={{ background: `${c}10`, color: c }}>
                    {result.score >= 70 ? '⚠' : '✓'}
                  </div>
                  {result.exploit_confirmed && (
                    <span className="badge-exploit">⚡ EXPLOITABLE</span>
                  )}
                </div>
              </div>

              <div className="result-fields">
                <Row label="Vuln"    value={result.vulnerability} vc={result.score >= 70 ? c : undefined} />
                <Row label="Chain"   value={result.chain} />
                <Row label="Address" value={`${result.address.slice(0, 10)}…${result.address.slice(-8)}`} mono />
                {result.value_usd > 0 && (
                  <Row label="Value" value={`$${result.value_usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`} />
                )}
              </div>

              {result.exploit_confirmed && result.exploit_output && (
                <div className="exploit-terminal">
                  <div className="exploit-terminal-header">
                    <div className="exploit-terminal-dot" />
                    FORGE TEST — EXPLOIT CONFIRMED
                  </div>
                  <pre className="exploit-terminal-output">{result.exploit_output}</pre>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

function Row({ label, value, vc, mono }: { label: string; value: string; vc?: string; mono?: boolean }) {
  return (
    <div className="result-row">
      <span className="result-row-label">{label}</span>
      <span className="result-row-value" style={{ color: vc, fontFamily: mono ? 'var(--mono)' : undefined }}>{value}</span>
    </div>
  )
}
