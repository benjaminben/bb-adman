// P7-19: sends one layer.update for the project and reports the result: the refusal's own
// sentence, or null when it was taken. The rows show the sentence under them.
// The timeline can be drawn without the app around it (P7-18's timeline tests do that); the
// rows are then shown but send nothing.
import { useApi } from '@/renderer/app/app-context'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { AdmanApi } from '@/shared/schemas/api'

export type LayerSend = (layerId: string, patch: LayerPatch) => void

function useApiIfAny(): AdmanApi | null {
  try {
    return useApi()
  } catch {
    return null
  }
}

export function useLayerSend(projectId: string, onResult: (message: string | null) => void) {
  const api = useApiIfAny()
  const send: LayerSend = (layerId, patch) => {
    if (!api) return
    void api.command('layer.update', { projectId, layerId, patch }).then((result) => {
      onResult(result.ok ? null : result.error.message)
    })
  }
  return send
}
