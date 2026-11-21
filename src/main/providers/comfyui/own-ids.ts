// SPEC 14 1.43 K-7 (security class: an ID from a project file must not stop someone's work
// on the server). One set, for the life of the app process, of the IDs this process sent to
// `submit` or got back from it. Only an ID in it may be removed from the queue or interrupted.
const own = new Set<string>()

export function rememberOwnId(promptId: string): void {
  own.add(promptId)
}

export function isOwnId(promptId: string): boolean {
  return own.has(promptId)
}
