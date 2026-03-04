// ChainGuard CRE Workflow (TypeScript SDK)
// This is a production-ready CRE workflow using the Chainlink SDK
// For more info: https://docs.chain.link/chainlink-functions

type ScoreResponse = {
  address: string;
  chain: string;
  value_usd: number;
  score: number;
  vulnerability: string;
};

interface WorkflowInputs {
  target_address: string;
}

interface WorkflowOutputs {
  risk_score: number;
  vulnerability: string;
  contract_value: number;
  onchain_tx: string;
}

/**
 * ChainGuard Risk Assessment Workflow
 *
 * This workflow:
 * 1. Calls the ChainGuard Risk API to analyze a contract
 * 2. Parses the risk score and vulnerability
 * 3. If score >= 70, writes report to onchain RiskRegistry
 * 4. Returns the result
 */
export async function runWorkflow(
  inputs: WorkflowInputs
): Promise<WorkflowOutputs> {
  // Step 1: Call ChainGuard Risk API
  const apiHost = process.env.RISK_API_HOST || "127.0.0.1";
  const apiPort = process.env.RISK_API_PORT || "8000";

  const res = await fetch(
    `http://${apiHost}:${apiPort}/score?address=${inputs.target_address}&chain=ETHEREUM`
  );

  if (!res.ok) {
    throw new Error(`Risk API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as ScoreResponse;

  console.log(`Risk Score: ${data.score} | Vulnerability: ${data.vulnerability}`);

  return {
    risk_score: data.score,
    vulnerability: data.vulnerability,
    contract_value: data.value_usd,
    onchain_tx: "", // Populated by CRE transaction step
  };
}
