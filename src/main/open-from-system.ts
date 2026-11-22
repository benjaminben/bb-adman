// A project file the system hands the app: a Finder or Explorer double-click, a file dropped
// on the Dock icon, or a second launch (spec/phases/round-2-platform.md D9). It opens through
// project.open with all its checks, as the user; on success the window is told to show it,
// a project that was already open as well. No Electron import; index.ts wires it.
import type { BusEvent, ExecuteOptions } from '@/main/commands/bus'
import type { Result } from '@/shared/schemas/result'

type Execute = (name: string, input: unknown, opts: ExecuteOptions) => Promise<Result<unknown>>

export type SystemOpenDeps<W> = {
  // Null until the core exists; an open before then waits in `pending`.
  execute: () => Execute | null
  mainWindow: () => W
  emit: (event: BusEvent) => void
  warn: (win: W, message: string) => Promise<unknown>
}

export function systemOpener<W>(deps: SystemOpenDeps<W>) {
  const pending: string[] = []

  async function open(filePath: string): Promise<void> {
    const execute = deps.execute()
    if (!execute) {
      pending.push(filePath)
      return
    }
    const win = deps.mainWindow()
    const result = await execute('project.open', { filePath }, { actor: 'user' })
    if (!result.ok) {
      await deps.warn(win, result.error.message)
      return
    }
    const { projectId } = result.data as { projectId: string }
    deps.emit({ name: 'app.showProject', payload: { projectId } })
  }

  function openPending(): void {
    for (const filePath of pending.splice(0)) void open(filePath)
  }

  return { open, openPending, pending }
}
