// spec/screens-variants.md, "Fan-out": after variant.fanOut succeeds, one generation.runFill
// per `fill` entry with the provider the user chose, through the app store's `command`, so the
// key, address and licence dialogs work as for a picture run and a refusal shows in the banner
// (the variants stay with their scaled background). Each started job is attached to its
// variant with a finish that sends generation.applyFill (A-131). The fills go one after
// another, so at most one dialog asks at a time.
import { useApi, useApp } from '@/renderer/app/app-context'
import { attachedStoreFor } from '@/renderer/stores/attached-store'
import type { GenerationRunFillReply } from '@/shared/schemas/commands/generation'
import type { VariantFanOutReply } from '@/shared/schemas/commands/variant'

export function useStartFills(projectId: string) {
  const api = useApi()
  const command = useApp((s) => s.command)

  return async function startFills(fill: VariantFanOutReply['fill'], provider: string) {
    const attached = attachedStoreFor(api)
    for (const { variantId } of fill) {
      const reply = await command('generation.runFill', { projectId, variantId, provider })
      if (!reply.ok) continue
      const { jobId } = reply.data as GenerationRunFillReply
      attached.getState().register(jobId, { projectId, variantId }, () => {
        void command('generation.applyFill', { projectId, jobId })
      })
    }
  }
}
