// publish.inspect (spec/phases/phase-09.md "Publishing"). User only: an agent is refused before
// the input is read, since the answer holds full local paths (A-218). The body is in
// src/main/publish/inspect.ts.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn, QueryOptions } from './types'
import { openFor } from './campaign-reads'
import { inspectPublish } from '@/main/publish/inspect'
import { PUBLISH_INSPECT_DENIED } from '@/shared/publish/messages'
import { publishInspectInput, type PublishInspect } from '@/shared/schemas/queries/publish'
import { AppError } from '@/shared/schemas/result'

function requireUser(opts: QueryOptions): void {
  if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', PUBLISH_INSPECT_DENIED)
}

export function publishInspect(deps: CoreDeps): QueryFn {
  return (raw, opts): Promise<PublishInspect> => {
    requireUser(opts)
    const { input, project } = openFor(deps, publishInspectInput, raw)
    return inspectPublish(deps, project, input)
  }
}

export function publishQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'publish.inspect': publishInspect(deps) }
}
