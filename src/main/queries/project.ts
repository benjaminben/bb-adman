// The project query domain (SPEC 12). Empty in Phase 2 step 0; its slice adds the queries.
import type { CoreDeps } from '../core-deps'
import type { QueryFn } from './types'

export function projectQueries(_deps: CoreDeps): Record<string, QueryFn> {
  return {}
}
