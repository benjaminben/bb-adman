import type { AdmanApi } from '@/shared/schemas/api'
import type { DropApi } from '@/shared/schemas/drop-api'

declare global {
  interface Window {
    api: AdmanApi
    drop?: DropApi
  }
}
