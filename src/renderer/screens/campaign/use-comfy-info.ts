// comfy.getInfo for the campaign page (spec/screens-campaign.md, "Shared pieces"): the video
// card, the panels' trial mark and the run row. It contacts nothing and holds the address,
// which the campaign page never draws.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'

export function useComfyInfo(): ComfyInfo | null {
  const api = useApi()
  const [info, setInfo] = useState<ComfyInfo | null>(null)
  useEffect(() => {
    let live = true
    void api.query('comfy.getInfo', {}).then((result) => {
      if (live && result.ok) setInfo(result.data as ComfyInfo | null)
    })
    return () => {
      live = false
    }
  }, [api])
  return info
}
