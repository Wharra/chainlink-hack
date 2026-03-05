import type { Alert, Stats, PipelineStatus, AnalyzeResult } from './types'

const BASE = '/api'

export async function fetchAlerts(): Promise<Alert[]> {
  const r = await fetch(`${BASE}/alerts`)
  if (!r.ok) throw new Error('Failed to fetch alerts')
  return r.json()
}

export async function fetchStats(): Promise<Stats> {
  const r = await fetch(`${BASE}/stats`)
  if (!r.ok) throw new Error('Failed to fetch stats')
  return r.json()
}

export async function fetchStatus(): Promise<PipelineStatus> {
  const r = await fetch(`${BASE}/status`)
  if (!r.ok) throw new Error('Failed to fetch status')
  return r.json()
}

export async function fetchAgentStatus(address: string): Promise<{ status: 'pending' | 'completed', output?: string }> {
  const r = await fetch(`${BASE}/poc_status?address=${encodeURIComponent(address)}`)
  if (!r.ok) throw new Error('Failed to fetch agent status')
  return r.json()
}

/**
 * Streams live Antigravity output via SSE.
 * Returns a cancel function to stop the stream.
 */
export function runAnalysis(
  address: string,
  onLine: (line: string) => void,
  onResult: (result: AnalyzeResult) => void,
  onError: (error: string) => void,
  onDone: () => void,
): () => void {
  const es = new EventSource(`${BASE}/run?address=${encodeURIComponent(address)}`)

  es.addEventListener('line', (e) => {
    onLine(JSON.parse((e as MessageEvent).data))
  })

  es.addEventListener('result', (e) => {
    onResult(JSON.parse((e as MessageEvent).data))
  })

  es.addEventListener('scan_error', (e) => {
    onError(JSON.parse((e as MessageEvent).data))
  })

  es.addEventListener('done', () => {
    es.close()
    onDone()
  })

  es.onerror = () => {
    onError('Connection lost — is the dashboard API running?')
    es.close()
    onDone()
  }

  return () => es.close()
}

export interface OnchainResult {
  tx_hash: string
  etherscan_url: string
  registry: string
}

export async function submitOnchain(
  address: string,
  score: number,
  vulnerability: string,
): Promise<OnchainResult> {
  const r = await fetch(`${BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, score, vulnerability }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'On-chain submission failed')
  return data
}

export async function analyzeAddress(address: string): Promise<AnalyzeResult> {
  const r = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, chain: 'ETHEREUM' }),
  })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Analysis failed')
  return data
}
