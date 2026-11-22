// P9-5b: the sign-in listener closes when the app quits. index.ts is the Electron entry and
// cannot be started in a test, so this reads its before-quit handler: the call comes after the
// early return for a quit the user may still cancel, next to the line that stops the MCP server.
// The process 'exit' hook in session.ts is gone.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('closing the Dropbox sign-in listener at quit [P9-5b]', () => {
  it('calls cancelDropboxSignIn() in before-quit, after the early return', () => {
    const index = read('src/main/index.ts')
    expect(index).toMatch(
      /import \{ cancelDropboxSignIn \} from '\.\/providers\/dropbox\/sign-in\/session'/,
    )
    const handler = index.slice(index.indexOf("app.on('before-quit'"))
    const early = handler.indexOf('return\n')
    const stop = handler.indexOf('void core?.mcp.stop()')
    const cancel = handler.indexOf('cancelDropboxSignIn()')
    expect(early).toBeGreaterThan(0)
    expect(cancel).toBeGreaterThan(early)
    expect(Math.abs(cancel - stop)).toBeLessThan(60)
  })

  it('no longer hooks process exit in session.ts', () => {
    expect(read('src/main/providers/dropbox/sign-in/session.ts')).not.toMatch(
      /process\.(once|on)\(/,
    )
  })
})
