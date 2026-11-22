// The ComfyUI server's state as one mark on its Section header (SET-2): "Not set", "Checking",
// "Connected" (the version in the tip) or "Failed" (the sentence in the tip, and also on the
// page under the field, drawn by the caller). Sentences come from their owner (S2-1).
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import { checkMessage, fillMarks } from '@/shared/providers/messages'
import { StatusMark } from '@/renderer/ui/status-mark'

// The failure sentence of a check, with the address filled in; null for an ok reply.
export function failureSentence(check: ComfyCheck, address: string): string | null {
  return check.outcome === 'ok' ? null : fillMarks(checkMessage(check.outcome), { address })
}

export function CheckMark(props: {
  address: string | null
  checking: boolean
  check: ComfyCheck | null
}) {
  const { address, check } = props
  if (address === null) return <StatusMark tone="none" label="Not set" tip="Not set" />
  if (props.checking) return <StatusMark tone="running" label="Checking" tip="Checking…" />
  if (check === null) return null
  const failure = failureSentence(check, address)
  if (failure !== null) {
    return <StatusMark tone="danger" icon="xCircle" label="Failed" tip={failure} />
  }
  const answered = `The server answered: ComfyUI ${check.version ?? ''}`
  const tip = check.note === undefined ? answered : `${answered} ${check.note}`
  return <StatusMark tone="ok" icon="check" label="Connected" tip={tip} />
}
