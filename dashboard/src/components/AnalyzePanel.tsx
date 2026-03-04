import { useState } from 'react'
import { analyzeAddress, fetchDemo } from '../api'
import type { AnalyzeResult } from '../types'

// Local fallbacks — demo always works even when API is offline
const DEMO_SAFE: AnalyzeResult = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  chain: 'ETHEREUM', value_usd: 6_193_540_905.88, score: 10,
  vulnerability: 'No significant vulnerability detected',
  exploit_confirmed: false, demo: true,
}
const DEMO_VULN: AnalyzeResult = {
  address: '0x4e2Bf022a5E5c91C4dc64d0D53680C8A862e81BD',
  chain: 'ETHEREUM', value_usd: 45_230.50, score: 95,
  vulnerability: 'Honeypot — _transfer blacklist trap: buying enabled, selling permanently blocked for all non-owner addresses',
  exploit_confirmed: true,
  exploit_output:
    'Running 1 test for test/HoneypotExploit.t.sol:HoneypotExploitTest\n' +
    '[PASS] testHoneypotTrap() (gas: 312,847)\n\n' +
    'Traces:\n' +
    '  [312847] HoneypotExploitTest::testHoneypotTrap()\n' +
    '    ├─ VM::deal(Attacker, 1 ETH)\n' +
    '    ├─ UniswapV3::exactInputSingle{ value: 1 ETH }(WETH → HONEYPOT)\n' +
    '    │   └─ ← Attacker receives 10,847,291 HONEYPOT tokens\n' +
    '    ├─ HONEYPOT::approve(UniswapV3Router, type(uint256).max)\n' +
    '    ├─ UniswapV3::exactInputSingle(HONEYPOT → WETH)  ← sell attempt\n' +
    '    │   └─ HONEYPOT::_transfer(Attacker → Pool)\n' +
    '    │       ├─ _blacklist[msg.sender] == true\n' +
    "    │       └─ ← [Revert] 'BEP20: transfer amount exceeds allowance'\n" +
    '    └─ assertEq(weth.balanceOf(Attacker), 0)  ✓\n\n' +
    '  ✗  1 ETH (≈ $3,240) permanently locked — 0% recovery possible\n' +
    '  ✓  Owner wallet excluded from blacklist (can sell freely)\n\n' +
    'Test result: ok. 1 passed; 0 failed; finished in 3.12s',
  demo: true,
}

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
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isValid = /^0x[0-9a-fA-F]{40}$/.test(address.trim())

  const handleAnalyze = async () => {
    if (!isValid) return
    setLoading(true); setResult(null); setError(null)
    try { setResult(await analyzeAddress(address.trim())) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unknown error') }
    finally { setLoading(false) }
  }

  const handleDemo = async (type: 'safe' | 'vuln') => {
    const fallback = type === 'vuln' ? DEMO_VULN : DEMO_SAFE
    setAddress(fallback.address)
    setLoading(true); setResult(null); setError(null)
    try { setResult(await fetchDemo(type)) }
    catch { setResult(fallback) }  // fallback: always works offline
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Analyze</div>
        </div>
        <div className="card-subtitle">Antigravity scoring</div>
      </div>

      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Demo */}
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

        {/* Input */}
        <div className="input-row">
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            placeholder="0x contract address"
            className={`input-address ${address && !isValid ? 'invalid' : ''}`}
          />
          <button
            onClick={handleAnalyze}
            disabled={!isValid || loading}
            className="btn-scan"
          >
            {loading ? '…' : 'SCAN'}
          </button>
        </div>

        {loading && (
          <div className="loading-box">
            <div className="spinner" />
            Analyzing contract…
            <div className="mono text-3" style={{ fontSize: '10px', marginTop: '2px' }}>~15–30s</div>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}

        {result && !loading && (() => {
          const c = scoreColor(result.score)
          return (
            <div className="result-card" style={{ border: `1px solid ${c}30` }}>
              {result.demo && (
                <div className="result-demo-banner">DEMO — preloaded fixture</div>
              )}

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
                <Row label="Vuln" value={result.vulnerability} vc={result.score >= 70 ? c : undefined} />
                <Row label="Chain" value={result.chain} />
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
