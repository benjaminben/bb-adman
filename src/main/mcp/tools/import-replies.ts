// The reply picker of import_assets (spec/phases/round-2-platform.md, D5): the asset IDs, one
// per given path, in input order. Named field by field, so nothing else the command returns
// (a path, a file name) can leave through MCP without a change here.
import type { ImportFilesReply } from '@/main/commands/asset/import-files'
import type { ReplyPicker } from './read-replies'

export const importedIds: ReplyPicker = (data) => ({
  assetIds: (data as ImportFilesReply).assetIds.map((id) => String(id)),
})
