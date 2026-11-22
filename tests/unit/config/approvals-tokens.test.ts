// The approvals service draws in the app's look from a byte-equal copy of the app's tokens, so
// the service still builds from its own folder alone (spec/phases/round-2-approvals.md "Where the
// look comes from (item 18)"). A token change is made in the app and copied in the same commit.
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const APP_TOKENS = 'src/renderer/ui/tokens.css'
const SERVICE_COPY = 'approvals-service/src/ui/app-tokens.css'

describe('approvals tokens copy', () => {
  it('keeps the service copy byte-equal to the app tokens', () => {
    const app = fs.readFileSync(APP_TOKENS)
    const service = fs.readFileSync(SERVICE_COPY)
    expect(service.equals(app)).toBe(true)
  })
})
