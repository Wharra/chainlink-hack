export interface Alert {
  chain: string
  time: number
  contract: string
  value_usd: number
  status: string
  score?: number
  output_name: string
  vulnerability: string
  exploit_confirmed?: boolean
}

export interface Stats {
  analyzed: number
  threats: number
  value_protected: number
}

export interface PipelineComponent {
  name: string
  description: string
  online: boolean
}

export interface PipelineStatus {
  risk_api: PipelineComponent
  sentry: PipelineComponent
  golden_bridge: PipelineComponent
  cre: PipelineComponent
}

export interface AnalyzeResult {
  address: string
  chain: string
  value_usd: number
  score: number
  vulnerability: string
  exploit_confirmed?: boolean
  exploit_output?: string
  demo?: boolean
  error?: string
}
