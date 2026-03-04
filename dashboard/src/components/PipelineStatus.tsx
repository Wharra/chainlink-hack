import type { PipelineStatus as PipelineStatusType, PipelineComponent } from '../types'

interface Props { status: PipelineStatusType | null }

const ORDER: (keyof PipelineStatusType)[] = ['sentry', 'golden_bridge', 'risk_api', 'cre']

const META: Record<string, { label: string; sub: string }> = {
  sentry: { label: 'EVM Sentry', sub: 'Uniswap V3 · V4' },
  golden_bridge: { label: 'Golden Bridge', sub: 'Gemini AI · Scoring' },
  risk_api: { label: 'Risk API', sub: 'HTTP · port 8000' },
  cre: { label: 'Chainlink CRE', sub: 'On-chain registry' },
}

export default function PipelineStatus({ status }: Props) {
  const onlineCount = status ? ORDER.filter(k => status[k]?.online).length : 0

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Pipeline</span>
        <span
          className="pipeline-summary"
          style={{ color: onlineCount === ORDER.length ? 'var(--green)' : 'var(--text-3)' }}
        >
          {status ? `${onlineCount}/${ORDER.length} ONLINE` : '—'}
        </span>
      </div>

      <div className="pipeline-list">
        {ORDER.map((key, i) => {
          const comp: PipelineComponent | undefined = status?.[key]
          const online = comp?.online ?? null
          const meta = META[key]
          const state = online === true ? 'online' : 'offline'

          return (
            <div key={key}>
              <div className={`pipeline-step ${state}`}>
                <div className="pipeline-step-left">
                  <span className={`pipeline-num ${state}`}>{i + 1}</span>
                  <div>
                    <div className={`pipeline-name ${online !== true ? 'offline' : ''}`}>
                      {meta.label}
                    </div>
                    <div className="pipeline-sub">{meta.sub}</div>
                  </div>
                </div>

                <div className="pipeline-status">
                  <div className={`pipeline-dot ${online === true ? 'online' : online === false ? 'offline' : 'unknown'}`} />
                  <span
                    className="pipeline-status-text"
                    style={{
                      color: online === true ? 'var(--green)' : online === false ? 'var(--red)' : 'var(--text-3)',
                    }}
                  >
                    {online === null ? '—' : online ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>

              {i < ORDER.length - 1 && <div className="pipeline-connector" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
