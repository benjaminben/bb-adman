import { CONTRACT_VERSION, SERVICE_NAME } from '../contract'
import { apiJson } from './errors'

// GET /api/v1/health: the app checks the contract number before it uses the service.
export async function health(): Promise<Response> {
  return apiJson({ service: SERVICE_NAME, contract: CONTRACT_VERSION })
}
