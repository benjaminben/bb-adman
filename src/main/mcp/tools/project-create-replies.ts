// The reply picker of create_project (spec/phases/round-2-platform.md, D8): the project's ID and
// the name the agent gave. Named field by field, so nothing else (the folder, the file path)
// can leave through MCP without a change here.
import type { CreatedProject } from '@/main/commands/project/create-default'
import type { ReplyPicker } from './read-replies'

export const createdProjectFields: ReplyPicker = (data) => {
  const made = data as CreatedProject
  return { projectId: String(made.projectId), name: String(made.name) }
}
