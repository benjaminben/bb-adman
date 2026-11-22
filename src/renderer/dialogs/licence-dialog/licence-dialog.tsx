// The commercial-licence dialog (spec/screens-campaign.md, "The commercial-licence dialog";
// D-088): a run command refused with licence_not_confirmed opens it. The model's name comes
// from comfy.getInfo by the refused workflow; it opens once that answer is in, so the box
// exists when focus is placed. The app store saves a ticked model and sends the run again.
// Design wave DLG-2: the `confirm` kind; every word as before.
import { useEffect, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import { LicenceChoices } from './licence-choices'

const UNKNOWN_MODEL = 'This model'

// The model label for a workflow, or null when the query fails or does not list it.
type Found = { workflow: string; model: string | null }

export function LicenceDialog() {
  const api = useApi()
  const request = useApp((s) => s.licenceRequest)
  const [found, setFound] = useState<Found | null>(null)
  const workflow = request?.workflow ?? null

  useEffect(() => {
    if (workflow === null) return
    let live = true
    void api.query('comfy.getInfo', {}).then((result) => {
      const info = result.ok ? (result.data as ComfyInfo | null) : null
      const model = info?.workflows.find((w) => w.id === workflow)?.model.label ?? null
      if (live) setFound({ workflow, model })
    })
    return () => {
      live = false
    }
  }, [api, workflow])

  const ready = request !== null && found?.workflow === request.workflow
  const model = ready ? found.model : null
  const saving = request?.saving ?? false

  return (
    <DialogFrame
      open={ready}
      onClose={() => request?.resolve({ confirmed: false, remember: null })}
      kind="confirm"
      title={`${model ?? UNKNOWN_MODEL} requires a commercial license, please confirm that you have one before production use`}
      closable={!saving}
    >
      <LicenceChoices
        model={model}
        saving={saving}
        onCancel={() => request?.resolve({ confirmed: false, remember: null })}
        onConfirm={(remember) => request?.resolve({ confirmed: true, remember })}
      />
    </DialogFrame>
  )
}
