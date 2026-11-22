// "Open another project…" in the project switcher (spec/phases/round-2-platform.md D9): the
// project file picker, then project.open; the app store shows the opened project and the ones
// already open stay open.
import { pickPath, useApi, useApp } from '@/renderer/app/app-context'

export function useOpenAnother(): () => Promise<void> {
  const api = useApi()
  const command = useApp((s) => s.command)
  return async () => {
    const filePath = await pickPath(api, 'dialog.pickProjectFile')
    if (filePath) await command('project.open', { filePath })
  }
}
