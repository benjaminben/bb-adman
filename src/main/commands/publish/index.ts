// The publish command domain (spec/phases/phase-09.md "Publishing"). publish.run and
// publish.setFontConsent (A-260) are deny for agents. Their slices fill the bodies; this list
// does not change.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { publishRun } from './run'
import { publishSetFontConsent } from './set-font-consent'

export function publishCommands(deps: CoreDeps): CommandHandler[] {
  return [publishRun(deps), publishSetFontConsent(deps)]
}
