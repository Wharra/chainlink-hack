import { useState, useEffect, useCallback } from 'react'
import { fetchAlerts, fetchStats, fetchStatus } from './api'
import type { Alert, Stats, PipelineStatus as PipelineStatusData } from './types'
import StatsBar from './components/StatsBar'
import AlertsTable from './components/AlertsTable'
import PipelineStatus from './components/PipelineStatus'
import AnalyzePanel from './components/AnalyzePanel'
import HistoryPage from './pages/HistoryPage'
import AboutPage from './pages/AboutPage'

type Page = 'dashboard' | 'history' | 'about'

/* ─── Ticker with real logos + fallback SVGs ──────── */
const TICKER_ITEMS = [
  //{ src: '/img/logo-chainguard.png', label: 'ChainGuard' },
  { src: null, label: 'Chainlink', svg: 'chainlink' },
  { src: '/img/uniswap.png', label: '' },
  { src: '/img/eth.png', label: '' },
  //{ src: null, label: 'Gemini AI', svg: 'gemini' },
  { src: '/img/alchemy.png', label: '' },
  { src: '/img/etherscan.svg', label: '' },
  { src: '/img/antigravity.png', label: '' },
]

function ChainlinkSVG() {
  return (
    <svg viewBox="0 0 37.8 43.6" className="ticker-logo" fill="#375BD2">
      <path d="M18.9 0l-4 2.3L4 8.6l-4 2.3v21.8l4 2.3 10.9 6.3 4 2.3 4-2.3L33.8 35l4-2.3V10.9l-4-2.3L22.9 2.3 18.9 0zm0 8.7l10.9 6.3v12.6L18.9 34 8 27.6V15l10.9-6.3z" />
    </svg>
  )
}

function GeminiSVG() {
  return (
    <svg viewBox="0 0 24 24" className="ticker-logo">
      <defs><linearGradient id="gm" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#4285F4" /><stop offset="100%" stopColor="#34A853" /></linearGradient></defs>
      <circle cx="12" cy="12" r="10" fill="url(#gm)" />
      <path d="M12 6l2.5 4.3H9.5L12 6zm-4 5h8l-4 7L8 11z" fill="#fff" opacity="0.9" />
    </svg>
  )
}

function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="ticker-wrap">
      <div className="ticker-fade-left" />
      <div className="ticker-fade-right" />
      <div className="ticker-track">
        {items.map((item, i) => (
          <div key={i} className="ticker-item">
            {item.src ? (
              <img src={item.src} alt={item.label} className="ticker-logo" />
            ) : item.svg === 'chainlink' ? (
              <ChainlinkSVG />
            ) : (
              <GeminiSVG />
            )}
            <span className="ticker-label">{item.label}</span>
          </div>
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

/* ─── Splash Screen ──────────────────────────────── */
function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 1800)
    const t2 = setTimeout(() => onDone(), 2400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div className={`splash${fading ? ' splash-out' : ''}`}>
      <div className="splash-wrap">
        <div className="splash-rings">
          <div className="splash-ring splash-r1" />
          <div className="splash-ring splash-r2" />
          <div className="splash-ring splash-r3" />
          <img src="/img/logo-chainguard.png" className="splash-logo" alt="" />
        </div>
        <div className="splash-name">ChainGuard</div>
      </div>
    </div>
  )
}

/* ─── Shield Wave Component ──────────────────────── */
function ShieldHero() {
  return (
    <div className="shield-hero">
      <div className="shield-wave shield-wave-1" />
      <div className="shield-wave shield-wave-2" />
      <div className="shield-wave shield-wave-3" />
      <div className="shield-glow" />
      <svg className="shield-icon" viewBox="0 0 64 64" fill="none">
        <path d="M32 4L56 14V36C56 48 44 58 32 62C20 58 8 48 8 36V14L32 4Z" fill="#2962ff" opacity="0.9" />
        <path d="M32 10L50 18V36C50 46 41 54 32 57C23 54 14 46 14 36V18L32 10Z" fill="var(--bg)" />
        <path d="M26 33L30 37L40 27" stroke="#26a69a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/* ─── App ─────────────────────────────────────────── */
export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [page, setPage] = useState<Page>('dashboard')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [status, setStatus] = useState<PipelineStatusData | null>(null)
  const [alertsLoading, setAlertsLoading] = useState(false)
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
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <header className="header">
        <div className="logo">
          <img src="/img/logo-chainguard.png" className="logo-icon-img" alt="ChainGuard" />
          <span className="logo-text">ChainGuard</span>
        </div>

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
          {page !== 'about' && (
            <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          )}
          <a href="https://chain.link/hackathon" target="_blank" rel="noreferrer" className="chainlink-badge">
            ◆ Chainlink
          </a>
        </div>
      </header>

      <Ticker />

      {page === 'dashboard' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="page-header" style={{ position: 'relative', overflow: 'hidden' }}>
            <ShieldHero />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div className="page-title">Overview</div>
              <div className="page-subtitle">Real-time DeFi threat monitoring · Uniswap V3 + V4</div>
            </div>
          </div>
          <div className="dashboard-content">
            <StatsBar stats={stats} />
            <div className="dashboard-grid">
              <AlertsTable alerts={alerts} loading={alertsLoading} />
              <div className="dashboard-sidebar">
                <PipelineStatus status={status} />
                <AnalyzePanel />
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
