// asset.importFiles (spec/phases/round-2-platform.md, D5): an agent's import of files by their
// full paths, asked every time. R2P-1 registers it against this stub, which refuses before it
// reads anything; R2P-5 builds it.
import { defineCommand } from '@/main/commands/types'
import { assetImportFilesInput } from '@/shared/schemas/commands/asset-files'
import { AppError } from '@/shared/schemas/result'

export function assetImportFiles() {
  return defineCommand({
    name: 'asset.importFiles',
    input: assetImportFilesInput,
    projectId: (input) => input.projectId,
    run(): never {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}
