// project.createInDefaultFolder (spec/phases/round-2-platform.md, D8): a new, empty project in
// the default projects folder, opened and put on the recent list as project.create does. The
// input is a name only; the folder is settings.defaultProjectDir, so an agent never names or
// learns a place. The reply is the ID and the name, never the file path.
import { defineCommand } from '@/main/commands/types'
import { createAndOpen } from './create'
import type { ProjectCommandDeps } from './deps'
import { projectCreateDefaultInput } from '@/shared/schemas/commands/project-default'
import { AppError } from '@/shared/schemas/result'

export type CreatedProject = { projectId: string; name: string }

// An unforeseen failure (a folder that cannot be written, say) is logged by the bus in full.
// Node's message names the path, so only the error's code goes on.
function withoutPath(e: unknown): unknown {
  if (e instanceof AppError) return e
  const code = typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : 'unknown'
  return new Error(`The project file could not be made (${code}).`)
}

export function projectCreateInDefaultFolder(deps: ProjectCommandDeps) {
  return defineCommand({
    name: 'project.createInDefaultFolder',
    input: projectCreateDefaultInput,
    changesAppState: true,
    run(_ctx, input) {
      let made: CreatedProject
      try {
        made = createAndOpen(deps, deps.settings.get().defaultProjectDir, input.name)
      } catch (e) {
        throw withoutPath(e)
      }
      const data: CreatedProject = { projectId: made.projectId, name: made.name }
      return { data, log: { projectId: data.projectId } }
    },
  })
}
