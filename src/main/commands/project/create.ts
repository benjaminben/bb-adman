// project.create (SPEC 4.2; FR-002, FR-004, R-06, R-07).
import fs from 'node:fs'
import path from 'node:path'
import { defineCommand } from '@/main/commands/types'
import { createProjectFile } from '@/main/db/project-file'
import { summary, type ProjectCommandDeps } from './deps'
import { projectCreateInput } from '@/shared/schemas/commands/project'
import { PROJECT_EXTENSION } from '@/shared/schemas/project'
import { AppError } from '@/shared/schemas/result'

export function projectCreate(deps: ProjectCommandDeps) {
  return defineCommand({
    name: 'project.create',
    input: projectCreateInput,
    changesAppState: true,
    run(_ctx, input) {
      if (!path.isAbsolute(input.location)) {
        throw new AppError('INVALID_INPUT', 'Choose a folder for the project.')
      }
      fs.mkdirSync(input.location, { recursive: true })
      const now = deps.now().toISOString()
      const handle = createProjectFile({
        filePath: path.join(input.location, `${input.name}${PROJECT_EXTENSION}`),
        name: input.name,
        appVersion: deps.appVersion,
        now,
      })
      deps.projects.add(handle)
      const data = summary(handle)
      deps.settings.touchRecent({ path: handle.filePath, name: data.name }, now)
      return { data, log: { projectId: handle.projectId } }
    },
  })
}
