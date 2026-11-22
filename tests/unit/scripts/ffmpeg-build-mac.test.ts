import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

type RunResult = { code: number; stdout: string }
type RunOptions = { cwd?: string; env?: Record<string, string>; show?: boolean }
type Run = (command: string, args: string[], options?: RunOptions) => Promise<RunResult>
type BuildModule = {
  buildMac: (options: {
    srcDir: string
    tmp: string
    configure: string[]
    runImpl?: Run
  }) => Promise<string>
}

const { buildMac } = (await import(
  /* @vite-ignore */ path.resolve('scripts/ffmpeg/build-mac.mjs')
)) as BuildModule
const committed = JSON.parse(fs.readFileSync('scripts/ffmpeg-sources.json', 'utf8')) as {
  source: { configure: string[] }
}

const srcDir = '/work/ffmpeg-9.0.2'
const tmp = '/work/tmp'
const configure = committed.source.configure

type Call = [string, string[], RunOptions | undefined]

function recording(calls: Call[], answer: (command: string) => number): Run {
  return async (command, args, options) => {
    calls.push([command, args, options])
    return { code: answer(command), stdout: '' }
  }
}

describe.skipIf(process.platform !== 'darwin')('buildMac [P7-3, A-189]', () => {
  it('runs ./configure with exactly the JSON flags, then make ffmpeg, with a fixed PATH', async () => {
    const calls: Call[] = []
    const binary = await buildMac({ srcDir, tmp, configure, runImpl: recording(calls, () => 0) })
    expect(binary).toBe(`${srcDir}/ffmpeg`)
    const [select, conf, make] = calls
    expect(select?.[0]).toBe('/usr/bin/xcode-select')
    expect(conf?.[0]).toBe(`${srcDir}/configure`)
    expect(conf?.[1]).toEqual(configure)
    expect(make?.[0]).toBe('/usr/bin/make')
    expect(make?.[1]).toEqual([expect.stringMatching(/^-j\d+$/), 'ffmpeg'])
    for (const call of [conf, make]) {
      expect(call?.[2]?.cwd).toBe(srcDir)
      expect(call?.[2]?.env).toEqual({
        PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
        LC_ALL: 'C',
        TMPDIR: tmp,
      })
    }
  })

  it('stops before configure and names the missing tools', async () => {
    const calls: Call[] = []
    const runImpl = recording(calls, (command) => (command.endsWith('xcode-select') ? 2 : 0))
    await expect(buildMac({ srcDir, tmp, configure, runImpl })).rejects.toThrow(
      /Xcode Command Line Tools/,
    )
    expect(calls.map(([command]) => command)).toEqual(['/usr/bin/xcode-select'])
  })

  it('stops when configure fails and does not run make', async () => {
    const calls: Call[] = []
    const runImpl = recording(calls, (command) => (command.endsWith('configure') ? 1 : 0))
    await expect(buildMac({ srcDir, tmp, configure, runImpl })).rejects.toThrow(/configure/)
    expect(calls.map(([command]) => command)).not.toContain('/usr/bin/make')
  })
})
