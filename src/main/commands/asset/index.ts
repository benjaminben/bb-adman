// The asset command domain (SPEC 12; SPEC 14, Slice A part 2, A2-1).
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { assetImport } from './import'
import { assetUpdate } from './update'
import { assetRemove } from './remove'
import { assetRelink } from './relink'
import { assetCheckChanged } from './check-changed'
import { assetAddGenerated } from './add-generated'
import { assetImportFiles } from './import-files'

export function assetCommands(deps: CoreDeps): CommandHandler[] {
  return [
    assetImport(deps),
    assetUpdate(),
    assetRelink(deps),
    assetRemove(),
    assetCheckChanged(deps),
    assetAddGenerated(deps),
    assetImportFiles(),
  ]
}
