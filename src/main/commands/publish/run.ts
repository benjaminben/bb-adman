// publish.run (spec/phases/phase-09.md "Publishing"). Agent policy deny. Stub (P9-1): refuses
// in prepare, before it reads the project, the storage or anything else, until P9-10 replaces
// the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { publishRefusal } from '@/shared/publish/messages'
import { publishRunInput, type PublishRunReply } from '@/shared/schemas/commands/publish'

export function publishRun(_deps: CoreDeps) {
  return defineCommand({
    name: 'publish.run',
    input: publishRunInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(publishRefusal('not_built_yet'))
    },
    run(): HandlerResult<PublishRunReply> {
      throw publishRefusal('not_built_yet')
    },
  })
}
