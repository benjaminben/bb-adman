// secret.delete (SPEC 4.2, 7.7; FR-170).
import { defineCommand } from '../types'
import type { CoreDeps } from '../../core-deps'
import { secretDeleteInput } from '../../../shared/schemas/secrets'

export function secretDelete(deps: Pick<CoreDeps, 'secrets'>) {
  return defineCommand({
    name: 'secret.delete',
    input: secretDeleteInput,
    changesAppState: true,
    run(_ctx, input) {
      deps.secrets.delete(input.name)
      return { data: { name: input.name } }
    },
  })
}
