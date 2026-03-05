import { useState, useEffect, useCallback } from 'react'
import { Sun, Moon, ShieldCheck } from 'lucide-react'
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
  { src: null, label: 'Chainlink', svg: 'chainlink' },
  { src: '/img/uniswap.png', label: '' },
  { src: '/img/eth.png', label: '' },
  { src: '/img/alchemy.png', label: '' },
  { src: null, label: 'Etherscan', svg: 'etherscan' },
  { src: '/img/antigravity.png', label: '' },
]

function ChainlinkSVG() {
  return (
    <svg viewBox="0 0 37.8 43.6" className="ticker-logo" fill="#375BD2">
      <path d="M18.9 0l-4 2.3L4 8.6l-4 2.3v21.8l4 2.3 10.9 6.3 4 2.3 4-2.3L33.8 35l4-2.3V10.9l-4-2.3L22.9 2.3 18.9 0zm0 8.7l10.9 6.3v12.6L18.9 34 8 27.6V15l10.9-6.3z" />
    </svg>
  )
}

function EtherscanSVG() {
  return (
    <svg viewBox="0 0 293.775 293.671" className="ticker-logo" fill="none">
      <path d="M61.01 133.4a15.1 15.1 0 0 1 15.07-15.09l24.88.08a15.1 15.1 0 0 1 15.1 15.1v80.4c2.83-.79 6.46-1.63 10.38-2.5a12.58 12.58 0 0 0 9.74-12.28V97.5a15.1 15.1 0 0 1 15.1-15.1h24.9a15.1 15.1 0 0 1 15.1 15.1v96.16s6.26-2.53 12.37-5.11a12.6 12.6 0 0 0 7.74-11.6V61.44a15.1 15.1 0 0 1 15.1-15.1h24.9a15.1 15.1 0 0 1 15.1 15.1v107.37c21.4-15.51 43.07-34.2 60.26-56.74a24.15 24.15 0 0 1 3.76-28.62 144.08 144.08 0 0 0-245.55 37.98 18.9 18.9 0 0 1 16.05-8.03Z" fill="#21325b" />
      <path d="M146.89 245.3a144 144 0 0 0 140.63-113.14c-21.33 28.09-53.77 52.1-86.35 69.91a24.13 24.13 0 0 1-25.93-2 23.68 23.68 0 0 1-9.67-19.03v-11.79c-5.36 1.38-10.88 2.88-16.68 4.58a18.85 18.85 0 0 1-5.38.79 19.06 19.06 0 0 1-18.94-18.13v-26.3c-5.45.94-11 1.93-15.35 3.07a18.9 18.9 0 0 1-23.26-18.4V99.6A144.06 144.06 0 0 0 2.85 146.84c0 54.47 30.37 102.05 75.14 127.32 30.07-14.43 55.44-28.86 68.9-28.86Z" fill="#979695" />
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
              <img
                src={item.src}
                alt={item.label}
                className="ticker-logo"
                style={item.src.includes('alchemy') || item.src.includes('antigravity') ? { height: '24px' } : {}}
              />
            ) : item.svg === 'chainlink' ? (
              <ChainlinkSVG />
            ) : (
              <EtherscanSVG />
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
      <img src="/img/logo-chainguard.png" className="shield-icon" alt="ChainGuard" />
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
          <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <a href="https://chain.link/hackathon" target="_blank" rel="noreferrer" className="chainlink-badge">
            <ShieldCheck size={12} strokeWidth={2.5} /> Chainlink
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
              <div className="page-subtitle">Watching Uniswap V3 and V4 pools on Ethereum mainnet</div>
            </div>
          </div>
          <div className="dashboard-content animate-slide-up stagger">
            <StatsBar stats={stats} />
            <div className="dashboard-grid stagger">
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
