// create_project (spec/phases/round-2-platform.md, D8): a new project in the default projects
// folder. R2P-1 adds the row as notBuilt (A-230); R2P-8 fills it.
import { notBuilt } from './not-built'
import type { ToolDef } from './table'

export const PROJECT_TOOLS: readonly ToolDef[] = [
  notBuilt('create_project', 'command', 'project.createInDefaultFolder'),
]
