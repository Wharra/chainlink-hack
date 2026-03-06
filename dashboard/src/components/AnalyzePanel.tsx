import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, AlertTriangle, Zap, Link, Download, ShieldCheck, ExternalLink } from 'lucide-react'
import { runAnalysis, submitOnchain, fetchAgentStatus } from '../api'
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

export interface ScanState {
  address: string
  loading: boolean
  result: AnalyzeResult | null
  error: string | null
  lines: string[]
  waitingForAgent: boolean
  scanStartTime: number
  submitting: boolean
  onchain: OnchainResult | null
  onchainError: string | null
  popupVisible: boolean
  modalOpen: boolean
}

export const initialScanState: ScanState = {
  address: '',
  loading: false,
  result: null,
  error: null,
  lines: [],
  waitingForAgent: false,
  scanStartTime: 0,
  submitting: false,
  onchain: null,
  onchainError: null,
  popupVisible: false,
  modalOpen: false,
}

interface Props {
  scan: ScanState
  setScan: React.Dispatch<React.SetStateAction<ScanState>>
}

export default function AnalyzePanel({ scan, setScan }: Props) {
  const { address, loading, result, error, lines, waitingForAgent, scanStartTime, submitting, onchain, onchainError, popupVisible, modalOpen } = scan
  const set = <K extends keyof ScanState>(k: K, v: ScanState[K]) => setScan(prev => ({ ...prev, [k]: v }))

  const terminalRef = useRef<HTMLPreElement>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') set('modalOpen', false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen])

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(address.trim())

  useEffect(() => {
    if (terminalRef.current)
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [lines])

  // Auto-dismiss popup after 12s
  useEffect(() => {
    if (popupVisible) {
      popupTimer.current = setTimeout(() => set('popupVisible', false), 12_000)
      return () => { if (popupTimer.current) clearTimeout(popupTimer.current) }
    }
  }, [popupVisible])

  const handleResult = async (res: AnalyzeResult) => {
    setScan(prev => ({ ...prev, result: res, waitingForAgent: res.score >= 70 }))
  }

  // Poll for agent completion
  useEffect(() => {
    let timer: number
    const poll = async () => {
      if (!waitingForAgent || !result) return
      try {
        const st = await fetchAgentStatus(result.address, scanStartTime)
        if (st.status === 'completed') {
          setScan(prev => ({
            ...prev,
            waitingForAgent: false,
            result: prev.result ? { ...prev.result, exploit_confirmed: true, exploit_output: st.output } : null,
            submitting: true,
            onchain: null,
            onchainError: null,
          }))
          try {
            const r = await submitOnchain(result.address, result.score, result.vulnerability)
            setScan(prev => ({ ...prev, onchain: r, popupVisible: true, submitting: false }))
          } catch (e) {
            setScan(prev => ({ ...prev, onchainError: e instanceof Error ? e.message : 'Submission failed', submitting: false }))
          }
        } else {
          timer = window.setTimeout(poll, 3000)
        }
      } catch {
        timer = window.setTimeout(poll, 3000)
      }
    }

    if (waitingForAgent) poll()
    return () => clearTimeout(timer)
  }, [waitingForAgent, result, scanStartTime])

  const startScan = (addr: string) => {
    if (cancelRef.current) cancelRef.current()
    setScan({
      address: addr,
      loading: true,
      result: null,
      error: null,
      lines: [`$ antigravity --address ${addr} --json`, ''],
      waitingForAgent: false,
      scanStartTime: Math.floor(Date.now() / 1000),
      submitting: false,
      onchain: null,
      onchainError: null,
      popupVisible: false,
      modalOpen: true,
    })
    cancelRef.current = runAnalysis(
      addr,
      (line) => setScan(prev => ({ ...prev, lines: [...prev.lines, line] })),
      handleResult,
      (err) => setScan(prev => ({ ...prev, error: err })),
      () => setScan(prev => ({ ...prev, loading: false })),
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
          <div className="card-subtitle">Score any contract</div>
        </div>

        <div className="sidebar-card-scroll">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Demo buttons */}
          <div className="demo-box">
            <div className="demo-label">DEMO</div>
            <div className="demo-buttons">
              <button onClick={() => handleDemo('safe')} disabled={loading} className="demo-btn demo-btn-safe" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <Check size={12} strokeWidth={3} /> Safe
              </button>
              <button onClick={() => handleDemo('vuln')} disabled={loading} className="demo-btn demo-btn-vuln" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <X size={12} strokeWidth={3} /> Honeypot
              </button>
            </div>
          </div>

          {/* Address input */}
          <div className="input-row">
            <input
              type="text"
              value={address}
              onChange={e => set('address', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              placeholder="0x contract address"
              className={`input-address ${address && !isValid ? 'invalid' : ''}`}
            />
            <button onClick={handleAnalyze} disabled={!isValid || loading} className="btn-scan">
              {loading ? '…' : 'SCAN'}
            </button>
          </div>

          {/* Scan status pill — reopens modal if closed */}
          {lines.length > 0 && !modalOpen && (
            <button
              onClick={() => set('modalOpen', true)}
              className="onchain-status"
              style={{ cursor: 'pointer', background: 'none', border: '1px solid var(--border-2)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left' }}
            >
              {loading
                ? <><div className="spinner" style={{ width: 8, height: 8, margin: 0, flexShrink: 0 }} /><span style={{ fontSize: '11px', color: 'var(--text-2)' }}>Scanning… <span style={{ color: 'var(--text-3)' }}>click to view</span></span></>
                : result
                  ? <><div className="exploit-terminal-dot" style={{ background: scoreColor(result.score) }} /><span style={{ fontSize: '11px', color: 'var(--text-2)' }}>Score <strong style={{ color: scoreColor(result.score) }}>{result.score}/100</strong> — <span style={{ color: 'var(--text-3)' }}>click to view</span></span></>
                  : null
              }
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Scan modal — rendered via portal so it survives page navigation */}
      {modalOpen && createPortal(
        <div className="scan-modal-backdrop" onClick={() => set('modalOpen', false)}>
          <div className="scan-modal" onClick={e => e.stopPropagation()}>
            <div className="scan-modal-header">
              <div>
                <div className="scan-modal-title">{loading ? 'Scanning contract' : 'Scan complete'}</div>
                <div className="scan-modal-addr">{address}</div>
              </div>
              <button className="scan-modal-close" onClick={() => set('modalOpen', false)} style={{ border: 'none' }}>
                <X size={14} />
              </button>
            </div>

            <div className="scan-modal-body">
              {/* Terminal */}
              {lines.length > 0 && (
                <div className="exploit-terminal">
                  <div className="exploit-terminal-header">
                    {loading
                      ? <><div className="spinner" style={{ width: 8, height: 8, margin: 0, flexShrink: 0 }} />SCANNING<span className="mono" style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-3)', textTransform: 'none' }}>15 to 30s</span></>
                      : <><div className="exploit-terminal-dot" style={{ background: 'var(--green)' }} />SCAN COMPLETE</>
                    }
                  </div>
                  <pre className="exploit-terminal-output" ref={terminalRef}>
                    {lines.join('\n')}
                  </pre>
                </div>
              )}

              {error && <div className="error-box">{error}</div>}

              {submitting && (
                <div className="onchain-status onchain-pending">
                  <div className="spinner" style={{ width: 10, height: 10, marginRight: 6 }} />
                  Publishing to Sepolia…
                </div>
              )}
              {onchainError && (
                <div className="onchain-status onchain-error" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={12} strokeWidth={3} /> Sepolia: {onchainError}
                </div>
              )}

              {result && !loading && (() => {
                const c = scoreColor(result.score)
                const isRegex = result.vulnerability?.startsWith('Regex:')
                return (
                  <div className="result-card" style={{ border: `1px solid ${c}30` }}>
                    <div className="result-score-section" style={{ background: `${c}08` }}>
                      <div>
                        <div className="result-score-value" style={{ color: c }}>
                          {isRegex ? 'KO' : <>{result.score}<span className="result-score-max">/100</span></>}
                        </div>
                        <div className="result-risk-label" style={{ color: c }}>
                          {isRegex ? 'DETECTED' : `${scoreLabel(result.score)} RISK`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <div className="result-icon" style={{ background: `${c}10`, color: c }}>
                          {result.score >= 70 ? <AlertTriangle size={18} /> : <Check size={18} strokeWidth={3} />}
                        </div>
                        {result.exploit_confirmed && (
                          <span className="badge-exploit" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Zap size={10} /> EXPLOITABLE
                          </span>
                        )}
                        {onchain && result.exploit_confirmed && (
                          <span className="badge-onchain" onClick={() => set('popupVisible', true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Link size={10} /> ON-CHAIN
                          </span>
                        )}
                        {result.exploit_confirmed && (
                          <a href="/api/report/pdf" download="ChainGuard_Report.pdf" className="badge-pdf" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', background: '#3b82f615', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
                            <Download size={10} /> DOWNLOAD PDF
                          </a>
                        )}
                      </div>
                    </div>

                    {result.score >= 70 && !result.exploit_confirmed && (
                      <div className="agent-warning-box" style={{ margin: '12px 16px', background: 'var(--orange-dim)', border: '1px solid var(--orange)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--orange)', fontWeight: 600 }}>
                          <AlertTriangle size={16} />
                          HIGH RISK DETECTED: AGENT ACTION REQUIRED
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                          The PoC request has been queued. Please type <code style={{ color: 'var(--text-1)', background: 'rgba(0,0,0,0.2)', padding: '2px 4px', borderRadius: '4px' }}>/generate_pocs</code> in your Antigravity IDE Chat to launch the Exploit Generator.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--orange)', marginTop: '4px' }}>
                          <div className="spinner" style={{ width: 10, height: 10, borderColor: 'var(--orange)', borderRightColor: 'transparent' }} />
                          Waiting for agent to complete exploit...
                        </div>
                      </div>
                    )}

                    <div className="result-fields">
                      <Row label="Vuln" value={result.vulnerability} vc={result.score >= 70 ? c : undefined} />
                      <Row label="Chain" value={result.chain} />
                      <Row label="Address" value={`${result.address.slice(0, 10)}…${result.address.slice(-8)}`} mono />
                      {result.value_usd > 0 && (
                        <Row label="Value" value={`$${result.value_usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`} />
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* On-chain popup */}
      {popupVisible && onchain && result && (
        <OnchainPopup
          result={result}
          onchain={onchain}
          onClose={() => set('popupVisible', false)}
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
    <div className="onchain-toast">
      <div className="onchain-toast-icon">
        <ShieldCheck size={18} strokeWidth={2.5} />
      </div>
      <div className="onchain-toast-content">
        <div className="onchain-toast-title">Alert recorded on-chain</div>
        <div className="onchain-toast-meta">
          Tx: {short(onchain.tx_hash)} <span className="onchain-toast-dot">·</span> Score: <span style={{ color: c, fontWeight: 700 }}>{result.score}</span>
        </div>
      </div>
      <div className="onchain-toast-actions">
        <a href={onchain.etherscan_url} target="_blank" rel="noopener noreferrer" className="onchain-toast-link">
          View Etherscan <ExternalLink size={12} />
        </a>
        <button onClick={onClose} className="onchain-toast-close" aria-label="Close">
          <X size={14} />
        </button>
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
