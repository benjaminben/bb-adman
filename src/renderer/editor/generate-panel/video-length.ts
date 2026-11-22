// The video length field (SPEC 14 1.57 TP-6, improvised choice 3): whole seconds, default 2,
// least 1, most the chosen start's workflow's maxMs from comfy.getInfo (1.60 N-9).
export { useComfyInfo } from '@/renderer/screens/campaign/use-comfy-info'

export const START_SECONDS = 2
export const LENGTH_PROBLEM = 'Enter a whole number of seconds, 1 or more.'

// The typed seconds, or null when it is not a whole number of 1 or more.
export function typedSeconds(typed: string): number | null {
  const seconds = Number(typed)
  return typed.trim() !== '' && Number.isInteger(seconds) && seconds >= 1 ? seconds : null
}
