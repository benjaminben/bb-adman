// The variant query domain (spec/editor-commands.md, "variant.get"). Registered empty by
// slice P3-0; slice P3-3 adds variant.get.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'

export function variantQueries(_deps: CoreDeps): Record<string, QueryFn> {
  return {}
}
