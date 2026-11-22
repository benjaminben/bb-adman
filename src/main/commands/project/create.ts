// project.create (SPEC 4.2; FR-002, FR-004, R-06, R-07).
import fs from 'node:fs'
import path from 'node:path'
import { defineCommand } from '@/main/commands/types'
import { createProjectFile } from '@/main/db/project-file'
import { summary, type ProjectCommandDeps } from './deps'
import { projectCreateInput } from '@/shared/schemas/commands/project'
import { PROJECT_EXTENSION, type OpenProjectSummary } from '@/shared/schemas/project'
import { AppError } from '@/shared/schemas/result'

// The create work, shared with project.createInDefaultFolder (R2P-8, D8): makes Name.adman in
// the folder, opens it and puts it at the top of the recent list.
export function createAndOpen(
  deps: ProjectCommandDeps,
  location: string,
  name: string,
): OpenProjectSummary {
  fs.mkdirSync(location, { recursive: true })
  const now = deps.now().toISOString()
  const handle = createProjectFile({
    filePath: path.join(location, `${name}${PROJECT_EXTENSION}`),
    name,
    appVersion: deps.appVersion,
    now,
  })
  deps.projects.add(handle)
  const data = summary(handle)
  deps.settings.touchRecent({ path: handle.filePath, name: data.name }, now)
  return data
}

export function projectCreate(deps: ProjectCommandDeps) {
  return defineCommand({
    name: 'project.create',
    input: projectCreateInput,
    changesAppState: true,
    run(_ctx, input) {
      if (!path.isAbsolute(input.location)) {
        throw new AppError('INVALID_INPUT', 'Choose a folder for the project.')
      }
      const data = createAndOpen(deps, input.location, input.name)
      return { data, log: { projectId: data.projectId } }
    },
  })
}
