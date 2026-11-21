// Stub until AP-2: GET /links/{projectId}/{campaignId}, the LinkState.
import type { ApiHandler } from '../app'
import { apiError } from './errors'

export const readLink: ApiHandler = async () => apiError(404, 'not_found')
