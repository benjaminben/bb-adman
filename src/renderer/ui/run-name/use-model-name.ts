// R3-2: names a stored model ID (an asset's or a report's): the registry's name, a shipped
// ComfyUI workflow's model by its main file, or the ID itself. Asks comfy.getInfo only when
// an ID is not a registry model.
import { useEffect, useState } from 'react'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { modelNameOf } from '@/shared/providers/model-words'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'

export function useModelName(ids: readonly string[]): (id: string) => string {
  const api = useApi()
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const [info, setInfo] = useState<ComfyInfo | null>(null)
  const needed = ids.some((id) => modelNameOf(id, providers) === id)
  useEffect(() => {
    if (!needed) return
    let live = true
    void api.query('comfy.getInfo', {}).then((result) => {
      if (live && result.ok) setInfo(result.data as ComfyInfo | null)
    })
    return () => {
      live = false
    }
  }, [api, needed])
  return (id) => modelNameOf(id, providers, info?.workflows)
}
