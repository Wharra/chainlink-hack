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
          <p className="ab-mint-eyebrow">Built for the Chainlink Hackathon</p>
          <h2 className="ab-mint-title">
            The premier <span className="ab-mint-spaced">DECENTRALISED</span><br />
            security layer
          </h2>
          <div className="ab-mint-layout">
            <div className="ab-feat-col ab-feat-left">
              <div className="ab-feat">
                <div className="ab-feat-title">Real time</div>
                <div className="ab-feat-body">Every new Uniswap pool gets scanned within seconds of going live on Ethereum mainnet.</div>
              </div>
              <div className="ab-feat">
                <div className="ab-feat-title">Deterministic + AI</div>
                <div className="ab-feat-body">Static analysis gives us strict Yes/No regex flags. Gemini 2.0 Flash gives us the intelligent 0-to-100 risk score context.</div>
              </div>
            </div>

            <div className="ab-mint-video-wrap">
              <video autoPlay loop muted playsInline>
                <source src="/img/12955464-hd_1920_1080_24fps.mp4" type="video/mp4" />
              </video>
            </div>

            <div className="ab-feat-col ab-feat-right">
              <div className="ab-feat">
                <div className="ab-feat-title">On chain</div>
                <div className="ab-feat-body">Every risk verdict gets recorded on Sepolia through Chainlink and stays there forever.</div>
              </div>
              <div className="ab-feat">
                <div className="ab-feat-title">Proven</div>
                <div className="ab-feat-body">We write a real Foundry exploit and run it against a mainnet fork to confirm the vulnerability is not theoretical.</div>
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
            Pool scanning and exploit confirmation are two of the things ChainGuard does.<br />
            But there is more under the hood.
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
          <h2 className="ab-pipe-title">7 stages. <span className="ab-pipe-thin">1 manual step.</span></h2>
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
        <div className="ab-footer-sub">Risk & Compliance Track · Chainlink CRE</div>
      </div>

    </div>
  )
}

/* ─── Data ─────────────────────────────────────────── */

const STACK = [
  { name: 'EVM Sentry', icon: 'EVS', desc: 'Watches Ethereum for new Uniswap pools as they get created' },
  { name: 'Golden Bridge', icon: 'GB', desc: 'Fetches contract source from Etherscan and checks pool value via Chainlink price feeds' },
  { name: 'Static Analysis', icon: 'SCN', desc: 'Deterministic regex rules output strict Yes/No flags for known honeypots and backdoors' },
  { name: 'Gemini 2.0 AI', icon: 'AI', desc: 'Reasons over source code and static flags to set a continuous Risk Score from 0 to 100' },
  { name: 'Antigravity', icon: 'AG', desc: 'Autonomous agent that writes Foundry exploits to mathematically prove the vulnerability exists' },
  { name: 'Chainlink CRE', icon: 'CRE', desc: 'Securely records the confirmed risk verdicts on-chain to RiskRegistry.sol on Sepolia' },
  { name: 'Risk API', icon: 'API', desc: 'HTTP server that the CRE workflow and this dashboard use to score contracts' },
  { name: 'Dashboard', icon: 'UI', desc: 'Live monitoring interface built with React and TypeScript' },
]

const STEPS = [
  { name: 'EVM Sentry', desc: 'Watches for PoolCreated and Initialize events on Ethereum mainnet through Alchemy WebSocket. When a new pool appears it extracts the token address and sends it downstream.' },
  { name: 'Golden Bridge', desc: 'Downloads the verified source from Etherscan and checks the pool value using the Chainlink ETH/USD price feed. Low value contracts get skipped.' },
  { name: 'Static Analysis', desc: 'A deterministic regex engine flags exact, known attack surfaces like uncapped mints or hidden delegatecalls. It provides the initial strict Yes/No boolean baseline.' },
  { name: 'Gemini Risk Scoring', desc: 'The contract source and static flags pass to Google Gemini 2.0 Flash. It reasons through the code, outputting an intelligent continuous Risk Score from 0 to 100.' },
  { name: 'Exploit Generation', desc: 'If the score reaches 70 or above, our Antigravity Agent takes over. It spawns a Foundry testing environment and autonomously writes a PoC to attack a live mainnet fork.' },
  { name: 'Mainnet Fork Validation', desc: 'The generated Foundry PoC is executed against a live mainnet fork. If the test passes, the vulnerability is strictly confirmed with zero false positives.' },
  { name: 'Risk API', desc: 'HTTP server with a /score endpoint. The Chainlink CRE workflow calls it automatically, and this dashboard uses it for manual scans.' },
  { name: 'Chainlink CRE', desc: 'A TypeScript workflow running on the Chainlink Compute Runtime. When a contract scores 70 or above it records the finding in RiskRegistry.sol on Sepolia where it stays permanently.' },
]
