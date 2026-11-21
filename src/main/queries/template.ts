// The template query domain (SPEC 12). Empty in Phase 2 step 0; its slice adds the queries.
import type { CoreDeps } from '../core-deps'
import type { QueryFn } from './types'

export function templateQueries(_deps: CoreDeps): Record<string, QueryFn> {
  return {}
}
