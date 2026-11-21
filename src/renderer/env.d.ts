import type { AdmanApi } from '@/shared/schemas/api'

declare global {
  interface Window {
    api: AdmanApi
  }
}
