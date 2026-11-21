// The render query domain (spec/editor-commands.md, "thumbnail.get" and "variant.render").
// Registered empty by slice P3-0; slice P3-7 adds both queries.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'

export function renderQueries(_deps: CoreDeps): Record<string, QueryFn> {
  return {}
}
