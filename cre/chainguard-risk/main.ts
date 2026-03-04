import { cre, Runner } from "@chainlink/cre-sdk"
import { onHttpTrigger } from "./httpCallback"

type Config = {
  riskApiUrl: string
  evms: Array<{
    registryAddress: string
    chainSelectorName: string
    gasLimit: string
  }>
}

const initWorkflow = (_config: Config) => {
  // HTTP Trigger: Receives contract address from sentry or manual call
  const httpCapability = new cre.capabilities.HTTPCapability()
  const httpTrigger = httpCapability.trigger({})

  return [cre.handler(httpTrigger, onHttpTrigger)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}

main()
