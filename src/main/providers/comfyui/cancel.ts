// SPEC 6.11.2, 6.10.14 and 14 1.43 K-7 (security class): stop a run this app process
// submitted. For any other ID nothing is sent and the outcome is `unknown`. A queued run is
// removed from the queue; a running one is interrupted only when the server's version takes
// an ID with /interrupt. Nothing else on the server is touched. No wait of its own (1.38).
import type { CancelOutcome } from '@/main/providers/types'
import type { ComfyClient } from './client'
import { MIN_TARGETED_INTERRUPT } from './limits'
import { isOwnId } from './own-ids'

type CancelClient = Pick<
  ComfyClient,
  'adopt' | 'queueIds' | 'removeFromQueue' | 'interrupt' | 'history'
>

function numbers(version: string): number[] | null {
  const match = /^v?(\d+(?:\.\d+)*)/.exec(version.trim())
  return match?.[1] ? match[1].split('.').map(Number) : null
}

// True when `version` can be read and is at least MIN_TARGETED_INTERRUPT.
export function takesTargetedInterrupt(version: string | undefined): boolean {
  const server = numbers(version ?? '')
  const least = numbers(MIN_TARGETED_INTERRUPT) ?? []
  if (!server) return false
  for (let i = 0; i < Math.max(server.length, least.length); i++) {
    const gap = (server[i] ?? 0) - (least[i] ?? 0)
    if (gap !== 0) return gap > 0
  }
  return true
}

export async function cancelOwnRun(
  client: CancelClient,
  promptId: string,
  serverVersion: string | undefined,
): Promise<CancelOutcome> {
  if (!isOwnId(promptId)) return 'unknown'
  try {
    client.adopt(promptId)
    const queue = await client.queueIds()
    if (queue.pending.includes(promptId)) {
      await client.removeFromQueue(promptId)
      return 'stopped'
    }
    if (queue.running.includes(promptId)) {
      if (!takesTargetedInterrupt(serverVersion)) return 'unknown'
      await client.interrupt(promptId)
      return 'stopped'
    }
    return (await client.history(promptId)) ? 'finished' : 'unknown'
  } catch {
    return 'unknown'
  }
}
