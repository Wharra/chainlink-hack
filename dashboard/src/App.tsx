import { useState, useEffect, useCallback } from 'react'
import { Sun, Moon } from 'lucide-react'
import { fetchAlerts, fetchStats, fetchStatus } from './api'
import type { Alert, Stats, PipelineStatus as PipelineStatusData } from './types'
import StatsBar from './components/StatsBar'
import AlertsTable from './components/AlertsTable'
import PipelineStatus from './components/PipelineStatus'
import AnalyzePanel, { type ScanState, initialScanState } from './components/AnalyzePanel'
import HistoryPage from './pages/HistoryPage'
import AboutPage from './pages/AboutPage'

type Page = 'dashboard' | 'history' | 'about'

/* ─── Ticker ──────────────────────────────────────── */
const TICKER_ITEMS = [
  { src: '/img/chainlink.svg', label: 'Chainlink', href: 'https://chain.link' },
  { src: '/img/uniswap.png', label: 'Uniswap', href: 'https://uniswap.org' },
  { src: '/img/eth.png', label: 'Ethereum', href: 'https://ethereum.org' },
  { src: '/img/alchemy.png', label: 'Alchemy', href: 'https://alchemy.com' },
  { src: '/img/etherscan.svg', label: 'Etherscan', href: 'https://etherscan.io' },
  { src: '/img/antigravity.png', label: 'Antigravity', href: 'https://antigravity.google' },
]

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="ticker-wrap">
      <div className="ticker-fade-left" />
      <div className="ticker-fade-right" />
      <div className="ticker-track">
        {items.map((item, i) => (
          <a key={i} className="ticker-item" href={item.href} target="_blank" rel="noreferrer" title={item.label}>
            <img src={item.src} alt={item.label} className="ticker-logo" />
          </a>
        ))}
      </div>
    </div>
  )
}

/* ─── Theme hook ──────────────────────────────────── */
function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('cg-theme')
    return (saved === 'light' || saved === 'dark') ? saved : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('cg-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  return { theme, toggle }
}

/* ─── Shield Wave Component ──────────────────────── */
function ShieldHero() {
  return (
    <div className="shield-hero">
      <div className="shield-wave shield-wave-1" />
      <div className="shield-wave shield-wave-2" />
      <div className="shield-wave shield-wave-3" />
      <div className="shield-glow" />
      <img src="/img/logo-chainguard.png" className="shield-icon" alt="ChainGuard" />
    </div>
  )
}

/* ─── App ─────────────────────────────────────────── */
export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [status, setStatus] = useState<PipelineStatusData | null>(null)
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [scan, setScan] = useState<ScanState>(initialScanState)
  const { theme, toggle: toggleTheme } = useTheme()

  // Track current page on root element for CSS targeting
  useEffect(() => {
    document.documentElement.setAttribute('data-page', page)
  }, [page])

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true)
    try { setAlerts(await fetchAlerts()) } catch { /* */ }
    finally { setAlertsLoading(false) }
  }, [])

  const loadStats = useCallback(async () => {
    try { setStats(await fetchStats()) } catch { /* */ }
  }, [])

  const loadStatus = useCallback(async () => {
    try { setStatus(await fetchStatus()) } catch { /* */ }
  }, [])

  useEffect(() => {
    loadAlerts(); loadStats(); loadStatus()
    const a = setInterval(loadAlerts, 5_000)
    const b = setInterval(loadStats, 10_000)
    const c = setInterval(loadStatus, 15_000)
    return () => { clearInterval(a); clearInterval(b); clearInterval(c) }
  }, [loadAlerts, loadStats, loadStatus])

  const threats = alerts.filter(a => {
    const v = a.vulnerability.toLowerCase()
    return !v.includes('no significant') && !v.includes('safe') && v !== 'none'
  }).length

  return (
    <>
      <header className="header">
        <div className="logo">
          <img src="/img/logo-chainguard.png" className="logo-icon-img" alt="ChainGuard" />
          <span className="logo-text">Chain<span className="logo-text-accent">Guard</span></span>
        </div>

        <div className="header-divider" />

        <nav className="nav">
          {(['dashboard', 'history', 'about'] as Page[]).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`nav-link ${page === p ? 'active' : ''}`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
              {p === 'history' && threats > 0 && <span className="nav-badge">{threats}</span>}
            </button>
          ))}
        </nav>

        <div className="header-right">
          <div className="live-dot">
            <div className="live-dot-circle" />
            <span className="live-dot-label">Live</span>
          </div>
          <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <a href="https://chain.link/hackathon" target="_blank" rel="noreferrer" className="chainlink-badge">
            <svg width="12" height="14" viewBox="0 0 37.8 43.6" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M18.9 0l-4 2.3L4 8.6l-4 2.3v21.8l4 2.3 10.9 6.3 4 2.3 4-2.3L33.8 35l4-2.3V10.9l-4-2.3L22.9 2.3 18.9 0zm0 8.7l10.9 6.3v12.6L18.9 34 8 27.6V15l10.9-6.3z" />
            </svg>
            Chainlink
          </a>
        </div>
      </header>

      <Ticker />

      {page === 'dashboard' && (
        <div className="dashboard-page">
          <div className="page-header" style={{ position: 'relative', overflow: 'hidden' }}>
            <ShieldHero />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div className="page-title">Overview</div>
              <div className="page-subtitle">Watching Uniswap V3 and V4 pools on Ethereum mainnet</div>
            </div>
          </div>
          <div className="dashboard-content">
            <StatsBar stats={stats} />
            <div className="dashboard-grid">
              <AlertsTable alerts={alerts} loading={alertsLoading} />
              <div className="dashboard-sidebar">
                <PipelineStatus status={status} />
                <AnalyzePanel scan={scan} setScan={setScan} />
              </div>
            </div>
          </div>
        </div>
      )}

      {page === 'history' && <HistoryPage alerts={alerts} loading={alertsLoading} />}
      {page === 'about' && <AboutPage />}

      <footer className="footer">
        <span>ChainGuard · Chainlink Hackathon 2026</span>
        <span>Risk &amp; Compliance Track</span>
      </footer>
    </>
  )
}
