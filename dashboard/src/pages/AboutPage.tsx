export default function AboutPage() {
  return (
    <div className="about-page">

      {/* ── 1. BRAND HERO ─────────────────────────── */}
      <section className="ab-hero">
        <div className="ab-logo-wrap">
          <div className="ab-ring ab-ring-1" />
          <div className="ab-ring ab-ring-2" />
          <div className="ab-ring ab-ring-3" />
          <img src="/img/logo-chainguard.png" className="ab-logo" alt="ChainGuard" />
        </div>
        <div className="ab-brand-name">ChainGuard</div>
      </section>

      {/* ── 2. MINT SECTION (Hyperliquid style 1) ─── */}
      <section className="ab-mint">
        <div className="ab-mint-inner">
          <p className="ab-mint-eyebrow">The flagship application</p>
          <h2 className="ab-mint-title">
            The premier <span className="ab-mint-spaced">DECENTRALISED</span><br />
            security layer
          </h2>
          <div className="ab-mint-layout">
            <div className="ab-feat-col ab-feat-left">
              <div className="ab-feat">
                <div className="ab-feat-title">Real-time</div>
                <div className="ab-feat-body">Every new Uniswap pool scanned within seconds of creation on Ethereum mainnet.</div>
              </div>
              <div className="ab-feat">
                <div className="ab-feat-title">AI-powered</div>
                <div className="ab-feat-body">Gemini AI reasons over contract source to catch novel attack vectors.</div>
              </div>
            </div>

            <div className="ab-mint-video-wrap">
              <video autoPlay loop muted playsInline>
                <source src="/img/12955464-hd_1920_1080_24fps.mp4" type="video/mp4" />
              </video>
            </div>

            <div className="ab-feat-col ab-feat-right">
              <div className="ab-feat">
                <div className="ab-feat-title">On-chain</div>
                <div className="ab-feat-body">Risk verdicts published immutably via Chainlink CRE to RiskRegistry.sol.</div>
              </div>
              <div className="ab-feat">
                <div className="ab-feat-title">Proven</div>
                <div className="ab-feat-body">Foundry PoC confirms every high-risk vulnerability is exploitable, not theoretical.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. DARK SECTION (Hyperliquid style 2) ─── */}
      <section className="ab-dark">
        <video autoPlay loop muted playsInline className="ab-dark-vid">
          <source src="/img/11904073_3840_2160_30fps.mp4" type="video/mp4" />
        </video>
        <div className="ab-dark-overlay" />
        <div className="ab-dark-inner">
          <p className="ab-dark-note-top">
            Pool scanning and exploit confirmation are two flagship features built on ChainGuard.<br />
            But they are just the tip of the iceberg.
          </p>
          <h2 className="ab-dark-title">
            The Chain<em>Guard</em> Stack
          </h2>
          <div className="ab-stack-grid">
            {STACK.map(s => (
              <div key={s.name} className="ab-stack-card">
                <div className="ab-stack-icon">{s.icon}</div>
                <div className="ab-stack-name">{s.name}</div>
                <div className="ab-stack-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. PIPELINE ────────────────────────────── */}
      <section className="ab-pipeline">
        <div className="ab-pipeline-inner">
          <p className="ab-pipe-eyebrow">How it works</p>
          <h2 className="ab-pipe-title">7 stages. <span className="ab-pipe-thin">Fully automated.</span></h2>
          <div className="ab-pipe-steps">
            {STEPS.map((step, i) => (
              <div key={step.name} className="ab-pipe-step">
                <div className="ab-pipe-num-col">
                  <div className="ab-pipe-num">{i + 1}</div>
                  {i < STEPS.length - 1 && <div className="ab-pipe-connector" />}
                </div>
                <div className="ab-pipe-body">
                  <div className="ab-pipe-step-name">{step.name}</div>
                  <div className="ab-pipe-step-desc">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="ab-footer-cta">
        <div className="ab-footer-text">ChainGuard · Chainlink Hackathon 2026</div>
        <div className="ab-footer-sub">Risk & Compliance Track · Built with Chainlink CRE</div>
      </div>

    </div>
  )
}

/* ─── Data ─────────────────────────────────────────── */

const STACK = [
  { name: 'EVM Sentry',      icon: 'EVS', desc: 'Listens for new pool events on Ethereum mainnet' },
  { name: 'Golden Bridge',   icon: 'GB',  desc: 'Source download + value filter via Chainlink feeds' },
  { name: 'Static Scan',     icon: 'SS',  desc: 'Deterministic pattern detection with Slither + regex' },
  { name: 'Antigravity',     icon: 'AG',  desc: 'CLI agent: static scan → Gemini Flash scoring → Foundry PoC auto-gen on mainnet fork' },
  { name: 'Exploit Runner',  icon: 'XR',  desc: 'Foundry PoC auto-gen + mainnet fork validation' },
  { name: 'Chainlink CRE',   icon: 'CRE', desc: 'Publishes immutable alerts to RiskRegistry.sol' },
  { name: 'Risk API',        icon: 'API', desc: 'HTTP server exposing the full pipeline' },
  { name: 'Dashboard',       icon: 'UI',  desc: 'Real-time monitoring — React + TypeScript' },
]

const STEPS = [
  { name: 'EVM Sentry',      desc: 'Listens for PoolCreated (V3) and Initialize (V4) events on Ethereum mainnet via Alchemy WebSocket. Extracts the token contract address from each new pool.' },
  { name: 'Golden Bridge',   desc: 'Downloads verified source code from Etherscan. Filters by minimum value using Chainlink ETH/USD price feed, then routes contracts to the scoring engine.' },
  { name: 'Static Scan',     desc: 'Regex + optional Slither: detects selfdestruct, uncapped mint, blacklist traps, mutable tax, delegatecall, time-bombs. Runs in <10ms.' },
  { name: 'Antigravity',     desc: 'Core AI engine. Static findings + full source → Gemini Flash → risk score 0–100 + vulnerability label. Catches known AND unknown patterns.' },
  { name: 'Exploit Runner',  desc: 'For high-risk contracts (score ≥ 70): Gemini generates a Foundry PoC → forge test on mainnet fork → confirmed or false-positive.' },
  { name: 'Risk API',        desc: 'HTTP server exposing the full pipeline as a /score endpoint — consumed by the Chainlink CRE workflow and this dashboard.' },
  { name: 'Chainlink CRE',   desc: 'TypeScript workflow on the Chainlink Compute Runtime. Calls Risk API → if score ≥ 70, publishes an immutable alert to RiskRegistry.sol on Sepolia.' },
]
