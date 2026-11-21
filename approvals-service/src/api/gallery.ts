// Stubs until AP-2: PUT .../gallery and PUT .../pictures.
import type { ApiHandler } from '../app'
import { apiError } from './errors'

export const replaceGallery: ApiHandler = async () => apiError(404, 'not_found')

export const renewPictures: ApiHandler = async () => apiError(404, 'not_found')
