// The open ask of agent.permissionRequested (spec/phases/phase-10.md, ask flow, A-238). The
// window gets no event when a request ends early, so the ask is dropped at its expiresAt; one
// that has already ended, or has no readable time, is never shown.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { EventMap } from '@/shared/schemas/events'

export type Ask = EventMap['agent.permissionRequested']

function msLeft(ask: Ask): number {
  return Date.parse(ask.expiresAt) - Date.now()
}

export function useAsk(): { ask: Ask | null; end: () => void } {
  const api = useApi()
  const [ask, setAsk] = useState<Ask | null>(null)

  useEffect(
    () =>
      api.on('agent.permissionRequested', (next) => {
        if (msLeft(next) > 0) setAsk(next)
      }),
    [api],
  )

  useEffect(() => {
    if (ask === null) return
    const timer = setTimeout(() => setAsk(null), msLeft(ask))
    return () => clearTimeout(timer)
  }, [ask])

  return { ask, end: () => setAsk(null) }
}
