import {
  cre,
  ok,
  consensusIdenticalAggregation,
  type Runtime,
  type HTTPPayload,
  type HTTPSendRequester,
  getNetwork,
  bytesToHex,
  hexToBase64,
  TxStatus,
  decodeJson,
} from "@chainlink/cre-sdk"
import { encodeAbiParameters, parseAbiParameters } from "viem"

type Config = {
  riskApiUrl: string
  evms: Array<{
    registryAddress: string
    chainSelectorName: string
    gasLimit: string
  }>
}

interface RiskRequest {
  address: string
}

interface RiskResponse {
  address: string
  chain: string
  value_usd: number
  score: number
  vulnerability: string
}

// ABI params for RiskRegistry.reportRisk(address, uint256, string)
const REPORT_RISK_PARAMS = parseAbiParameters(
  "address target, uint256 score, string vulnerability"
)

// Builder function following the CRE HTTPClient pattern
const buildRiskRequest =
  (address: string, riskApiUrl: string) =>
  (sendRequester: HTTPSendRequester, _config: Config): RiskResponse => {
    const req = {
      url: `${riskApiUrl}/score?address=${address}&chain=ETHEREUM`,
      method: "GET" as const,
    }

    const resp = sendRequester.sendRequest(req).result()
    const bodyText = new TextDecoder().decode(resp.body)

    if (!ok(resp)) {
      throw new Error(`ChainGuard Risk API error: ${resp.statusCode} - ${bodyText}`)
    }

    return JSON.parse(bodyText) as RiskResponse
  }

export function onHttpTrigger(runtime: Runtime<Config>, payload: HTTPPayload): string {
  runtime.log("════════════════════════════════════════════════════════")
  runtime.log("  ChainGuard CRE — Smart Contract Risk Detection")
  runtime.log("  Powered by Chainlink CRE + Gemini AI + Etherscan")
  runtime.log("════════════════════════════════════════════════════════")

  // ── Step 1: Parse incoming contract address ──────────────────
  if (!payload.input || payload.input.length === 0) {
    throw new Error("Empty payload — expected {address: '0x...'}")
  }

  const body = decodeJson(payload.input) as RiskRequest
  const contractAddress = body.address

  if (!contractAddress || !contractAddress.startsWith("0x")) {
    throw new Error(`Invalid address: ${contractAddress}`)
  }

  runtime.log(`[Step 1] Target contract: ${contractAddress}`)

  // ── Step 2: Call ChainGuard Risk API ─────────────────────────
  // risk_api.py internally calls:
  //   → Etherscan API (fetch verified source code)
  //   → Google Gemini AI (vulnerability analysis)
  //   → Chainlink Data Feeds (ETH/USD price)
  runtime.log(`[Step 2] Calling ChainGuard Risk API: ${runtime.config.riskApiUrl}`)

  const httpClient = new cre.capabilities.HTTPClient()

  const riskData = httpClient
    .sendRequest(
      runtime,
      buildRiskRequest(contractAddress, runtime.config.riskApiUrl),
      consensusIdenticalAggregation<RiskResponse>()
    )(runtime.config)
    .result()

  // ── Step 3: Log analysis results ─────────────────────────────
  runtime.log(`[Step 3] ── Analysis Complete ──`)
  runtime.log(`[Step 3]   Score       : ${riskData.score}/100`)
  runtime.log(`[Step 3]   Vulnerability: ${riskData.vulnerability}`)
  runtime.log(`[Step 3]   Value USD   : $${riskData.value_usd.toFixed(2)}`)
  runtime.log(
    `[Step 3]   Risk Level : ${
      riskData.score >= 85
        ? "🔴 CRITICAL"
        : riskData.score >= 70
        ? "🟠 HIGH"
        : riskData.score >= 50
        ? "🟡 MEDIUM"
        : "🟢 LOW"
    }`
  )

  // ── Step 4: Write onchain if dangerous ───────────────────────
  if (riskData.score >= 70) {
    runtime.log(`[Step 4] ⚠️  DANGER DETECTED — Publishing onchain alert...`)

    const evmConfig = runtime.config.evms[0]

    const network = getNetwork({
      chainFamily: "evm",
      chainSelectorName: evmConfig.chainSelectorName,
      isTestnet: true,
    })

    if (!network) {
      throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`)
    }

    const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)

    // Encode reportRisk(address target, uint256 score, string vulnerability)
    const reportData = encodeAbiParameters(REPORT_RISK_PARAMS, [
      contractAddress as `0x${string}`,
      BigInt(riskData.score),
      riskData.vulnerability,
    ])

    // Generate CRE signed report
    const reportResponse = runtime
      .report({
        encodedPayload: hexToBase64(reportData),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result()

    // Write to RiskRegistry.sol on Sepolia
    runtime.log(`[Step 4] Writing to RiskRegistry: ${evmConfig.registryAddress}`)

    const writeResult = evmClient
      .writeReport(runtime, {
        receiver: evmConfig.registryAddress as `0x${string}`,
        report: reportResponse,
        gasConfig: { gasLimit: evmConfig.gasLimit },
      })
      .result()

    if (writeResult.txStatus === TxStatus.SUCCESS) {
      const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32))
      runtime.log(`[Step 5] ✅ ONCHAIN ALERT PUBLISHED!`)
      runtime.log(`[Step 5]   TxHash  : ${txHash}`)
      runtime.log(`[Step 5]   Registry: ${evmConfig.registryAddress}`)
      runtime.log(`[Step 5]   Contract: ${contractAddress}`)
      runtime.log(`[Step 5]   Score   : ${riskData.score}/100`)
      runtime.log("════════════════════════════════════════════════════════")
      return txHash
    }

    throw new Error(`Transaction failed with status: ${writeResult.txStatus}`)
  }

  // Safe contract
  runtime.log(`[Step 4] ✅ Contract is safe (score: ${riskData.score}/100)`)
  runtime.log("════════════════════════════════════════════════════════")
  return `SAFE:${riskData.score}|${riskData.vulnerability}`
}
