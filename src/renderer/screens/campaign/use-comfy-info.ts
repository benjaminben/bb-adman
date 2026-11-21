// comfy.getInfo for the campaign page (spec/screens-campaign.md, "Shared pieces"): the video
// card, the panels' trial mark and the run row. It contacts nothing and holds the address,
// which the campaign page never draws.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'

export type ComfyInfoState = { info: ComfyInfo | null; loaded: boolean }

const WAITING: ComfyInfoState = { info: null, loaded: false }

// `loaded` turns true once the query has answered, also when it was refused.
export function useComfyInfoState(): ComfyInfoState {
  const api = useApi()
  const [state, setState] = useState(WAITING)
  useEffect(() => {
    let live = true
    void api.query('comfy.getInfo', {}).then((result) => {
      if (live)
        setState({ info: result.ok ? (result.data as ComfyInfo | null) : null, loaded: true })
    })
    return () => {
      live = false
    }
  }, [api])
  return state
}

export function useComfyInfo(): ComfyInfo | null {
  return useComfyInfoState().info
}
