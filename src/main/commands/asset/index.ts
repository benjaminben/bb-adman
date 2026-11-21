// The asset command domain (SPEC 12; SPEC 14, Slice A part 2, A2-1).
import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { assetImport } from './import'
import { assetUpdate } from './update'
import { assetRemove } from './remove'

export function assetCommands(deps: CoreDeps): CommandHandler[] {
  return [assetImport(deps), assetUpdate(), assetRemove()]
}
