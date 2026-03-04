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

export async function fetchDemo(type: 'safe' | 'vuln'): Promise<AnalyzeResult> {
  const r = await fetch(`${BASE}/demo?type=${type}`)
  if (!r.ok) throw new Error('Demo fetch failed')
  return r.json()
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
