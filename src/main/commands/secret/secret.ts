// secret.set and secret.delete (SPEC 4.2, 7.7; FR-170, FR-172, R-10).
// A key is not tested when entered. The value is never returned or logged.
import { defineCommand } from '../types'
import type { SecretStore } from '../../secrets/secret-store'
import { secretSetInput, secretDeleteInput } from '../../../shared/schemas/secrets'

export function secretSet(deps: { secrets: SecretStore }) {
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

export function secretDelete(deps: { secrets: SecretStore }) {
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
