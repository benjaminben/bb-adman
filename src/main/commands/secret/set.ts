// secret.set (SPEC 4.2, 7.7; FR-170, FR-172, R-10). A key is not tested when entered.
// The value is never returned or logged.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { secretSetInput } from '@/shared/schemas/secrets'

export function secretSet(deps: Pick<CoreDeps, 'secrets'>) {
  return defineCommand({
    name: 'secret.set',
    input: secretSetInput,
    changesAppState: true,
    run(_ctx, input) {
      deps.secrets.set(input.name, input.value)
      return { data: { name: input.name } }
    },
  })
}
