import { useState, useRef, useEffect } from 'react'
import { runAnalysis, submitOnchain } from '../api'
import type { OnchainResult } from '../api'
import type { AnalyzeResult } from '../types'

const DEMO_SAFE_ADDR = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const DEMO_VULN_ADDR = '0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413'

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
  const [address,   setAddress]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState<AnalyzeResult | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [lines,     setLines]     = useState<string[]>([])

  // On-chain submission state
  const [submitting,   setSubmitting]   = useState(false)
  const [onchain,      setOnchain]      = useState<OnchainResult | null>(null)
  const [onchainError, setOnchainError] = useState<string | null>(null)
  const [popupVisible, setPopupVisible] = useState(false)

  const terminalRef = useRef<HTMLPreElement>(null)
  const cancelRef   = useRef<(() => void) | null>(null)
  const popupTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(address.trim())

  useEffect(() => {
    if (terminalRef.current)
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [lines])

  // Auto-dismiss popup after 12s
  useEffect(() => {
    if (popupVisible) {
      popupTimer.current = setTimeout(() => setPopupVisible(false), 12_000)
      return () => { if (popupTimer.current) clearTimeout(popupTimer.current) }
    }
  }, [popupVisible])

  const handleResult = async (res: AnalyzeResult) => {
    setResult(res)
    // Auto-submit on-chain if score >= 70
    if (res.score >= 70) {
      setSubmitting(true)
      setOnchain(null)
      setOnchainError(null)
      try {
        const r = await submitOnchain(res.address, res.score, res.vulnerability)
        setOnchain(r)
        setPopupVisible(true)
      } catch (e) {
        setOnchainError(e instanceof Error ? e.message : 'Submission failed')
      } finally {
        setSubmitting(false)
      }
    }
  }

  const startScan = (addr: string) => {
    if (cancelRef.current) cancelRef.current()
    setAddress(addr)
    setLoading(true)
    setResult(null)
    setError(null)
    setLines([`$ antigravity --address ${addr} --exploit --json`, ''])
    setOnchain(null)
    setOnchainError(null)
    setPopupVisible(false)
    cancelRef.current = runAnalysis(
      addr,
      (line) => setLines(prev => [...prev, line]),
      handleResult,
      (err)  => setError(err),
      ()     => setLoading(false),
    )
  }

  const handleAnalyze = () => { if (isValid) startScan(address.trim()) }
  const handleDemo = (type: 'safe' | 'vuln') =>
    startScan(type === 'vuln' ? DEMO_VULN_ADDR : DEMO_SAFE_ADDR)

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div><div className="card-title">Analyze</div></div>
          <div className="card-subtitle">Antigravity scoring</div>
        </div>

        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Demo buttons */}
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

          {/* Live terminal */}
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

          {/* On-chain status badge (while submitting or if error) */}
          {submitting && (
            <div className="onchain-status onchain-pending">
              <div className="spinner" style={{ width: 10, height: 10, marginRight: 6 }} />
              Publishing to Sepolia…
            </div>
          )}
          {onchainError && (
            <div className="onchain-status onchain-error">
              ⚠ Sepolia: {onchainError}
            </div>
          )}

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
                    {onchain && (
                      <span className="badge-onchain" onClick={() => setPopupVisible(true)}>
                        ⛓ ON-CHAIN
                      </span>
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

      {/* On-chain popup */}
      {popupVisible && onchain && result && (
        <OnchainPopup
          result={result}
          onchain={onchain}
          onClose={() => setPopupVisible(false)}
        />
      )}
    </>
  )
}

function OnchainPopup({ result, onchain, onClose }: {
  result: AnalyzeResult
  onchain: OnchainResult
  onClose: () => void
}) {
  const c = scoreColor(result.score)
  const short = (s: string) => `${s.slice(0, 8)}…${s.slice(-6)}`

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-card" onClick={e => e.stopPropagation()}>
        <div className="popup-header">
          <div className="popup-chain-dot" />
          <span>ONCHAIN ALERT PUBLISHED</span>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>

        <div className="popup-network">
          <img src="/img/chainlink.png" alt="Chainlink" style={{ width: 16, height: 16, objectFit: 'contain' }} onError={e => (e.currentTarget.style.display = 'none')} />
          Sepolia Testnet · Chainlink CRE
        </div>

        <div className="popup-fields">
          <div className="popup-row">
            <span className="popup-label">Contract</span>
            <span className="popup-value mono">{short(result.address)}</span>
          </div>
          <div className="popup-row">
            <span className="popup-label">Score</span>
            <span className="popup-value" style={{ color: c, fontWeight: 600 }}>
              {result.score}/100 — {scoreLabel(result.score)}
            </span>
          </div>
          <div className="popup-row">
            <span className="popup-label">Registry</span>
            <span className="popup-value mono">{short(onchain.registry)}</span>
          </div>
          <div className="popup-row">
            <span className="popup-label">Tx</span>
            <span className="popup-value mono">{short(onchain.tx_hash)}</span>
          </div>
        </div>

        <a
          href={onchain.etherscan_url}
          target="_blank"
          rel="noopener noreferrer"
          className="popup-etherscan-btn"
        >
          View on Etherscan →
        </a>
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
