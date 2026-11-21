// The app and the approvals service share one contract by a byte-equal copy, so neither build
// imports the other's code (spec/approvals-service.md "The shared contract", A-83).
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'

const APP_COPY = 'src/shared/approvals/contract.ts'
const SERVICE_COPY = 'approvals-service/src/contract.ts'

function zodVersion(packageFile: string): string | undefined {
  const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8')) as {
    dependencies?: Record<string, string>
  }
  return pkg.dependencies?.zod
}

describe('approvals contract copy [A-83]', () => {
  it('keeps the service copy byte-equal to the app copy', () => {
    const app = fs.readFileSync(APP_COPY)
    const service = fs.readFileSync(SERVICE_COPY)
    expect(service.equals(app)).toBe(true)
  })

  it('pins the same zod version in both package.json files', () => {
    const app = zodVersion('package.json')
    expect(app).toMatch(/^\d+\.\d+\.\d+$/)
    expect(zodVersion('approvals-service/package.json')).toBe(app)
  })
})
