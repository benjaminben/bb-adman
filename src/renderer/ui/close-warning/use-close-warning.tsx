// Asks before a close (spec/screens-ai.md, "Where it shows"): `ask` picks the owner's attached
// jobs from the window's store; with none it closes at once, else it shows the warning and
// closes only on "Stop and close". The caller draws `warning`.
import { useCallback, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import {
  attachedStoreFor,
  type AttachedJob,
  type AttachedStoreState,
} from '@/renderer/stores/attached-store'
import { CloseWarning } from './close-warning'
import type { ClosePlace } from './close-words'

type Asked = { jobs: AttachedJob[]; close: () => void }
export type PickJobs = (s: AttachedStoreState) => AttachedJob[]

export function useCloseWarning(place: ClosePlace) {
  const store = attachedStoreFor(useApi())
  const [asked, setAsked] = useState<Asked | null>(null)

  const ask = useCallback(
    (pick: PickJobs, close: () => void) => {
      const jobs = pick(store.getState())
      if (jobs.length === 0) close()
      else setAsked({ jobs, close })
    },
    [store],
  )

  const warning = (
    <CloseWarning
      jobs={asked?.jobs ?? []}
      place={place}
      onKeep={() => setAsked(null)}
      onStopped={() => {
        setAsked(null)
        asked?.close()
      }}
    />
  )
  return { ask, warning }
}
