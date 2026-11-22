// The single-instance lock (SPEC 12; spec/phases/round-2-platform.md D9). Electron keys the
// lock on the app data folder, so test apps with their own ADMAN_USER_DATA_DIR each hold
// their own. On macOS the lock is asked for once the app is ready, so the files macOS sent at
// launch ('open-file') are already pending and go with it; on Windows it is asked for at once
// (the file comes on the command line). A losing instance quits with no window and no core.
// The winner treats what a second launch sends as untrusted text: only project paths that
// pass isHandoffPath reach `open`, and a refused one is dropped without a word.
import { handoffPaths, isHandoffPath, MAX_HANDOFF_PATHS, projectPathFromArgv } from './open-file'

type SecondInstance = (event: unknown, argv: string[], cwd: string, data: unknown) => void

export type LockApp = {
  requestSingleInstanceLock(data?: Record<string, unknown>): boolean
  on(event: 'second-instance', listener: SecondInstance): unknown
  quit(): void
  whenReady(): Promise<unknown>
}

export type SingleInstanceDeps = {
  platform: NodeJS.Platform
  pendingPaths: () => string[]
  open: (filePath: string) => void
  wake: () => void
  // Runs once the lock is held: the quit handlers.
  onLocked: () => void
  start: () => void
}

// The handed-over list first; else a project path on the second launch's command line.
export function secondLaunchPaths(
  argv: string[],
  data: unknown,
  platform: NodeJS.Platform,
): string[] {
  const handed = handoffPaths(data, platform)
  if (handed.length > 0) return handed
  const fromArgv = projectPathFromArgv(argv)
  return isHandoffPath(fromArgv, platform) ? [fromArgv] : []
}

export function runSingleInstance(app: LockApp, deps: SingleInstanceDeps): void {
  function claim(): boolean {
    const paths = deps.pendingPaths().slice(0, MAX_HANDOFF_PATHS)
    if (!app.requestSingleInstanceLock({ paths })) {
      app.quit()
      return false
    }
    app.on('second-instance', (_event, argv, _cwd, data) => {
      const found = secondLaunchPaths(argv, data, deps.platform)
      if (found.length === 0) deps.wake()
      found.forEach((filePath) => deps.open(filePath))
    })
    deps.onLocked()
    return true
  }

  if (deps.platform === 'darwin') {
    void app.whenReady().then(() => {
      if (claim()) deps.start()
    })
  } else if (claim()) {
    void app.whenReady().then(deps.start)
  }
}
