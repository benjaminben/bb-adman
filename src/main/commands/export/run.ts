// export.run (spec/phases/phase-08.md "The output folder", "Export run"). Security class: takes
// a folder path from the window. Agent policy deny. Stub (P8-1): refuses in prepare, before it
// reads the folder, the project or anything else, until P8-5 replaces the body.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { exportRunInput, type ExportRunReply } from '@/shared/schemas/commands/export'
import { exportRefusal } from '@/shared/export/messages'

export function exportRun(_deps: CoreDeps) {
  return defineCommand({
    name: 'export.run',
    input: exportRunInput,
    projectId: (input) => input.projectId,
    prepare(): Promise<undefined> {
      return Promise.reject(exportRefusal('export_not_built'))
    },
    run(): HandlerResult<ExportRunReply> {
      throw exportRefusal('export_not_built')
    },
  })
}
