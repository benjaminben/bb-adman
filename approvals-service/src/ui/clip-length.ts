// round-2-approvals-video.md "The gallery": a clip's length in whole seconds, rounded up, as
// m:ss ("0:01", "0:30", "1:05", "3:00").
export function clipLength(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  const rest = String(seconds % 60).padStart(2, '0')
  return `${Math.floor(seconds / 60)}:${rest}`
}
