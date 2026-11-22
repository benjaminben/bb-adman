// R3-2: a job row's provider and the words naming its service and model (run-name.ts). Asks
// comfy.getInfo only for a ComfyUI row that stored no model; until it answers, the plain label.
import { useEffect, useState } from 'react'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import type { JobRow } from '@/shared/schemas/rows/job'
import { needsComfyInfo, runName } from './run-name'

type Row = Pick<JobRow, 'kind' | 'provider' | 'model' | 'request'>

export type RunNameState = { provider: ProviderInfo | undefined; words: string }

export function useRunName(row: Row | null, fallback: string): RunNameState {
  const api = useApi()
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const [info, setInfo] = useState<ComfyInfo | null>(null)
  const needed = needsComfyInfo(row)
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
  if (row === null) return { provider: undefined, words: fallback }
  const provider = providers.find((p) => p.id === row.provider)
  return { provider, words: runName(row, providers, info, fallback) }
}
