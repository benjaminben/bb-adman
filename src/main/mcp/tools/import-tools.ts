// import_assets (spec/phases/round-2-platform.md, D5): an agent imports files by their full
// paths. The command's policy is ask, and the user sees every full path each time; the broker
// never lets mcp.autoApproveDestructive answer it (D7). The reply is the asset IDs only.
import { importFilesInput } from '@/main/commands/asset/import-files'
import { importedIds } from './import-replies'
import type { ToolDef } from './table'
import { LEAVE_THE_CHOICE } from './tool-words'

export const IMPORT_TOOLS: readonly ToolDef[] = [
  {
    name: 'import_assets',
    description:
      'Import picture, video or font files into an open project by their full paths, at most ' +
      '20 at a time. The user is asked every time and sees each full path; you wait up to two ' +
      'minutes, and a refusal is final. Each file is copied into the project. Gives one asset ' +
      'ID per path, in order. Text files, SVG and folders are not accepted. ' +
      LEAVE_THE_CHOICE,
    kind: 'command',
    target: 'asset.importFiles',
    input: importFilesInput,
    reply: importedIds,
  },
]
