// P7-20: sends one clip command for the project and reports the result: the refusal's own
// sentence, or null when it was taken. The track shows the sentence under its row.
import { useApi } from '@/renderer/app/app-context'

export type Send = (name: string, input: Record<string, unknown>) => void

export function useClipSend(projectId: string, onResult: (message: string | null) => void): Send {
  const api = useApi()
  return (name, input) => {
    void api.command(name, { projectId, ...input }).then((result) => {
      onResult(result.ok ? null : result.error.message)
    })
  }
}
