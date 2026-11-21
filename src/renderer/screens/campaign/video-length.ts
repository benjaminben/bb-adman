// The video length field (SPEC 14 1.57 TP-6, improvised choice 3): whole seconds, default 2,
// least 1, most the prompt-only workflow's maxMs from comfy.getInfo.
import { useEffect, useState } from 'react'
import { useApi } from '../../app/app-context'
import type { ComfyInfo } from '../../../shared/schemas/queries/comfy'

export const START_SECONDS = 2
export const LENGTH_PROBLEM = 'Enter a whole number of seconds, 1 or more.'

// The workflow generation.startVideo picks for a video from a prompt alone (CU-6a).
export function promptOnlyMaxMs(info: ComfyInfo | null): number | null {
  const fit = info?.workflows.find(
    (w) =>
      w.job === 'video' &&
      w.videoStart?.firstFrame === false &&
      w.videoStart.references === false &&
      w.video !== undefined,
  )
  return fit?.video?.maxMs ?? null
}

// comfy.getInfo contacts nothing and holds the address, which this panel never draws.
export function useComfyMaxMs(): number | null {
  const api = useApi()
  const [maxMs, setMaxMs] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    void api.query('comfy.getInfo', {}).then((result) => {
      if (live && result.ok) setMaxMs(promptOnlyMaxMs(result.data as ComfyInfo | null))
    })
    return () => {
      live = false
    }
  }, [api])
  return maxMs
}

// The typed seconds, or null when it is not a whole number of 1 or more.
export function typedSeconds(typed: string): number | null {
  const seconds = Number(typed)
  return typed.trim() !== '' && Number.isInteger(seconds) && seconds >= 1 ? seconds : null
}
