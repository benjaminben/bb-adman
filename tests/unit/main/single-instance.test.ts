import { describe, expect, it, vi } from 'vitest'
import { runSingleInstance, secondLaunchPaths, type LockApp } from '@/main/single-instance'

// spec/phases/round-2-platform.md D9 (R2P-9): on macOS the lock is asked for once the app is
// ready, carrying the files macOS sent at launch; on Windows it is asked for at once. A
// losing instance quits and starts nothing.
type SecondInstance = (event: unknown, argv: string[], cwd: string, data: unknown) => void

function fakeApp(wins: boolean) {
  let onSecond: SecondInstance | null = null
  let ready: () => void = () => undefined
  const readyPromise = new Promise<void>((resolve) => (ready = resolve))
  const app = {
    requestSingleInstanceLock: vi.fn((_data?: Record<string, unknown>) => wins),
    on: vi.fn((_name: 'second-instance', listener: SecondInstance) => {
      onSecond = listener
    }),
    quit: vi.fn(),
    whenReady: () => readyPromise,
  } satisfies LockApp
  const second: SecondInstance = (...args) => onSecond?.(...args)
  return { app, ready, second }
}

function deps(platform: NodeJS.Platform, pending: string[] = []) {
  return {
    platform,
    pendingPaths: () => pending,
    open: vi.fn(),
    wake: vi.fn(),
    onLocked: vi.fn(),
    start: vi.fn(),
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('the single-instance lock [R2P-9, D9]', () => {
  it('on macOS asks once ready, with the pending files, then starts', async () => {
    const { app, ready } = fakeApp(true)
    const d = deps('darwin', ['/a/Spring.adman'])
    runSingleInstance(app, d)
    expect(app.requestSingleInstanceLock).not.toHaveBeenCalled()
    ready()
    await tick()
    expect(app.requestSingleInstanceLock).toHaveBeenCalledWith({ paths: ['/a/Spring.adman'] })
    expect(d.onLocked).toHaveBeenCalled()
    expect(d.start).toHaveBeenCalled()
  })

  it('on Windows asks at once and starts when ready', async () => {
    const { app, ready } = fakeApp(true)
    const d = deps('win32')
    runSingleInstance(app, d)
    expect(app.requestSingleInstanceLock).toHaveBeenCalled()
    expect(d.onLocked).toHaveBeenCalled()
    expect(d.start).not.toHaveBeenCalled()
    ready()
    await tick()
    expect(d.start).toHaveBeenCalled()
  })

  it.each(['darwin', 'win32'] as const)(
    'on %s a losing instance quits and starts nothing',
    async (p) => {
      const { app, ready } = fakeApp(false)
      const d = deps(p)
      runSingleInstance(app, d)
      ready()
      await tick()
      expect(app.quit).toHaveBeenCalled()
      expect(app.on).not.toHaveBeenCalled()
      expect(d.onLocked).not.toHaveBeenCalled()
      expect(d.start).not.toHaveBeenCalled()
    },
  )

  it('hands over at most 20 of the pending files', async () => {
    const { app, ready } = fakeApp(false)
    const pending = Array.from({ length: 25 }, (_, i) => `/a/P${i}.adman`)
    runSingleInstance(app, deps('darwin', pending))
    ready()
    await tick()
    expect(app.requestSingleInstanceLock).toHaveBeenCalledWith({ paths: pending.slice(0, 20) })
  })

  it('opens each handed-over file, or shows the window when none came', async () => {
    const { app, ready, second } = fakeApp(true)
    const d = deps('darwin')
    runSingleInstance(app, d)
    ready()
    await tick()
    second({}, ['/x/Adman'], '/', { paths: ['/a/A.adman', 'B.adman', '/a/C.adman'] })
    expect(d.open.mock.calls).toEqual([['/a/A.adman'], ['/a/C.adman']])
    expect(d.wake).not.toHaveBeenCalled()
    second({}, ['/x/Adman'], '/', { paths: ['relative.adman'] })
    expect(d.wake).toHaveBeenCalledTimes(1)
    expect(d.open).toHaveBeenCalledTimes(2)
  })
})

describe('secondLaunchPaths [R2P-9, D9]', () => {
  it('reads the handed-over list first', () => {
    const data = { paths: ['/a/A.adman'] }
    expect(secondLaunchPaths(['/x/Adman', '/a/B.adman'], data, 'darwin')).toEqual(['/a/A.adman'])
  })

  it('falls back to the command line, with the same checks', () => {
    const argv = (p: string) => ['C:\\Adman\\Adman.exe', '--flag', p]
    expect(secondLaunchPaths(argv('C:\\a\\B.adman'), undefined, 'win32')).toEqual([
      'C:\\a\\B.adman',
    ])
    expect(secondLaunchPaths(argv('\\\\server\\s\\B.adman'), undefined, 'win32')).toEqual([])
    expect(secondLaunchPaths(argv('B.adman'), undefined, 'win32')).toEqual([])
    expect(secondLaunchPaths(['/x/Adman', '--a.adman'], undefined, 'darwin')).toEqual([])
  })
})
