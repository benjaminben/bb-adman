// create_project (spec/phases/round-2-platform.md, D8): a new, empty project in the user's
// default projects folder, opened in the app. The agent gives a name only and reads back the ID
// and that name, never the folder or the file path.
import { projectCreateDefaultInput } from '@/shared/schemas/commands/project-default'
import { createdProjectFields } from './project-create-replies'
import type { ToolDef } from './table'

export const PROJECT_TOOLS: readonly ToolDef[] = [
  {
    name: 'create_project',
    description:
      "Create a new, empty project in the user's default projects folder and open it in the " +
      "app. name is the project's name and its file name: no folder, at most 100 characters. " +
      "An existing file is never replaced. Gives the project's ID to use as project_id.",
    kind: 'command',
    target: 'project.createInDefaultFolder',
    input: projectCreateDefaultInput,
    reply: createdProjectFields,
  },
]
