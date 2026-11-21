// Stubs until AP-2: POST /links, PUT .../password and DELETE of a link.
import type { ApiHandler } from '../app'
import { apiError } from './errors'

export const createLink: ApiHandler = async () => apiError(404, 'not_found')

export const setPassword: ApiHandler = async () => apiError(404, 'not_found')

export const removeLink: ApiHandler = async () => apiError(404, 'not_found')
