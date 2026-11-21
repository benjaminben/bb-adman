import { describe, it, expect } from 'vitest'
import { createSerial } from '../../../../src/main/mcp/serial'

const tick = () => new Promise((r) => setTimeout(r, 5))

describe('createSerial [REVIEW MCP-A R-1]', () => {
  it('starts each task only after the one before has finished', async () => {
    const serial = createSerial()
    const seen: string[] = []
    const slow = serial(async () => {
      seen.push('a start')
      await tick()
      seen.push('a end')
    })
    const fast = serial(async () => {
      seen.push('b start')
    })
    await Promise.all([slow, fast])
    expect(seen).toEqual(['a start', 'a end', 'b start'])
  })

  it('gives a failure to its own caller and still runs the next task', async () => {
    const serial = createSerial()
    const bad = serial(async () => {
      throw new Error('first failed')
    })
    const good = serial(async () => 2)
    await expect(bad).rejects.toThrow('first failed')
    expect(await good).toBe(2)
  })
})
