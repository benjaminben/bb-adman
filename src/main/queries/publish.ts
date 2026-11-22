// publish.inspect (spec/phases/phase-09.md "Publishing"). User only: an agent is refused before
// the input is read, since the answer holds full local paths (A-218). Stub (P9-1): checks the
// input, then refuses as not built, until P9-9 replaces the body.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn, QueryOptions } from './types'
import { PUBLISH_INSPECT_DENIED, publishRefusal } from '@/shared/publish/messages'
import { publishInspectInput, type PublishInspect } from '@/shared/schemas/queries/publish'
import { AppError } from '@/shared/schemas/result'

function requireUser(opts: QueryOptions): void {
  if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', PUBLISH_INSPECT_DENIED)
}

export function publishInspect(_deps: CoreDeps): QueryFn {
  return (raw, opts): PublishInspect => {
    requireUser(opts)
    if (!publishInspectInput.safeParse(raw).success) {
      throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    }
    throw publishRefusal('not_built_yet')
  }
}

export function publishQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'publish.inspect': publishInspect(deps) }
}
