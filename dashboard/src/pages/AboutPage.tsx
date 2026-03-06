export default function AboutPage() {
  return (
    <div className="about-page">

      {/* ── 1. MINT SECTION ───────────────────────────── */}
      <section className="ab2-mint">
        <div className="ab2-mint-inner">
          <div className="ab2-mint-top">
            <div className="ab2-mint-label">Built for the Chainlink Hackathon</div>
            <h2 className="ab2-mint-title">
              The <span className="ab2-mint-word">premier</span>{' '}
              <span className="ab2-mint-tracked">DECENTRALISED</span>
              <br />
              <span className="ab2-mint-thin">security layer</span>
            </h2>
          </div>

          <div className="ab2-mint-layout">
            {/* Left features */}
            <div className="ab2-feat-col ab2-feat-left">
              {FEATURES_LEFT.map((f, i) => (
                <div key={f.title} className="ab2-feat">
                  <div className="ab2-feat-num">0{i + 1}</div>
                  <div>
                    <div className="ab2-feat-title">{f.title}</div>
                    <div className="ab2-feat-body">{f.body}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Centre video */}
            <div className="ab2-video-wrap">
              <div className="ab2-video-frame">
                <video autoPlay loop muted playsInline>
                  <source src="/img/12955464-hd_1920_1080_24fps.mp4" type="video/mp4" />
                </video>
              </div>
            </div>

            {/* Right features */}
            <div className="ab2-feat-col ab2-feat-right">
              {FEATURES_RIGHT.map((f, i) => (
                <div key={f.title} className="ab2-feat">
                  <div className="ab2-feat-num">0{i + 3}</div>
                  <div>
                    <div className="ab2-feat-title">{f.title}</div>
                    <div className="ab2-feat-body">{f.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. STACK SECTION ──────────────────────────── */}
      <section className="ab2-stack">
        <div className="ab2-stack-dot-grid" aria-hidden="true" />
        <div className="ab2-stack-inner">
          <div className="ab2-stack-header">
            <div className="ab2-stack-pre">Architecture</div>
            <h2 className="ab2-stack-title">
              The Chain<em>Guard</em> Stack
            </h2>
            <p className="ab2-stack-sub">
              Pool scanning and exploit confirmation are two of the things ChainGuard does.
              <br />But there is more under the hood.
            </p>
          </div>

          <div className="ab2-stack-grid">
            {STACK.map((s, i) => (
              <div key={s.name} className="ab2-stack-card">
                <div className="ab2-stack-card-idx">{String(i + 1).padStart(2, '0')}</div>
                <div className="ab2-stack-card-body">
                  <div className="ab2-stack-abbr">{s.icon}</div>
                  <div className="ab2-stack-name">{s.name}</div>
                  <div className="ab2-stack-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. PIPELINE SECTION ───────────────────────── */}
      <section className="ab2-pipeline">
        <div className="ab2-pipeline-inner">
          <div className="ab2-pipe-header">
            <div className="ab2-pipe-pre">How it works</div>
            <h2 className="ab2-pipe-title">
              7 stages.{' '}
              <span className="ab2-pipe-thin">1 manual steps.</span>
            </h2>
          </div>

          <div className="ab2-pipe-steps">
            {STEPS.map((step, i) => (
              <div key={step.name} className="ab2-pipe-step">
                <div className="ab2-pipe-step-head">
                  <div className="ab2-pipe-step-num">{String(i + 1).padStart(2, '0')}</div>
                  <div className="ab2-pipe-step-name">{step.name}</div>
                  {i < STEPS.length - 1 && <div className="ab2-pipe-step-rule" />}
                </div>
                <div className="ab2-pipe-step-desc">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}

/* ─── Data ─────────────────────────────────────────── */

const FEATURES_LEFT = [
  {
    title: 'Real time',
    body: 'Every new Uniswap pool gets scanned within seconds of going live on Ethereum mainnet.',
  },
  {
    title: 'Deterministic first',
    body: 'Static regex analysis runs first. If a HIGH vulnerability is found, the verdict is instant and deterministic. No AI call needed.',
  },
]

const FEATURES_RIGHT = [
  {
    title: 'On chain',
    body: 'Every risk verdict gets recorded on Sepolia through Chainlink and stays there forever.',
  },
  {
    title: 'Proven',
    body: 'We write a real Foundry exploit and run it against a mainnet fork to confirm the vulnerability is not theoretical.',
  },
]

const STACK = [
  { name: 'EVM Sentry', icon: 'EVS', desc: 'Watches Ethereum for new Uniswap pools as they get created' },
  { name: 'Golden Bridge', icon: 'GB', desc: 'Fetches contract source from Etherscan and checks pool value via Chainlink price feeds' },
  { name: 'Static Analysis', icon: 'SCN', desc: 'Deterministic regex rules run first. A HIGH finding instantly sets the verdict with no AI needed.' },
  { name: 'Gemini 2.0 AI', icon: 'AI', desc: 'Second layer: if regex finds nothing critical, Gemini 2.0 Flash reasons over the source code to assign a Risk Score from 0 to 100.' },
  { name: 'Batch Runner', icon: 'BR', desc: 'Tier-1 exploit engine: adapts a proven Foundry template for the detected vulnerability type and confirms it against a mainnet fork automatically.' },
  { name: 'Antigravity', icon: 'AG', desc: 'Tier-2 agent for novel vectors: writes a custom Foundry exploit from scratch, iterates until it passes, then saves the result as a reusable template.' },
  { name: 'Chainlink CRE', icon: 'CRE', desc: 'Securely records the confirmed risk verdicts on-chain to RiskRegistry.sol on Sepolia' },
  { name: 'Risk API', icon: 'API', desc: 'HTTP server that the CRE workflow and this dashboard use to score contracts' },
]

const STEPS = [
  { name: 'EVM Sentry', desc: 'Watches for PoolCreated and Initialize events on Ethereum mainnet through Alchemy WebSocket. When a new pool appears it extracts the token address and sends it downstream.' },
  { name: 'Golden Bridge', desc: 'Downloads the verified source from Etherscan and checks the pool value using the Chainlink ETH/USD price feed. Low value contracts get skipped.' },
  { name: 'Static Analysis', desc: 'A deterministic regex engine runs first. It flags known attack surfaces like uncapped mints or hidden delegatecalls. If a HIGH finding is detected, the verdict is immediate with no AI call made.' },
  { name: 'Gemini Risk Scoring', desc: 'Second layer, only if regex found nothing critical. The contract source and static flags pass to Gemini 2.0 Flash, which reasons through the code and outputs a continuous Risk Score from 0 to 100.' },
  { name: 'Exploit Generation', desc: 'If the score reaches 70 or above, the two-tier exploit engine fires. The Batch Runner first tries to adapt a proven template for the flagged vulnerability type. For novel vectors with no existing template, the Antigravity Agent writes a custom Foundry PoC from scratch and saves it as a new template for future runs.' },
  { name: 'Mainnet Fork Validation', desc: 'The generated Foundry PoC is executed against a live mainnet fork. If the test passes, the vulnerability is strictly confirmed with zero false positives.' },
  { name: 'Chainlink CRE', desc: 'A TypeScript workflow running on the Chainlink Compute Runtime. When a contract scores 70 or above it records the finding in RiskRegistry.sol on Sepolia where it stays permanently.' },
]
