// SPEC 14 1.56 E2E-R, "The address": every step that holds the address, a photo path or a
// file name on screen runs inside this guard. Whatever it throws is replaced by one fixed
// sentence with the step's name and no cause, so Playwright has nothing else to print: not
// the call log, not the element text, not a page snapshot from the matcher.
export const HIDDEN_FAILURE =
  'this step failed. Its details are hidden so that no address, path or key is printed.'

export async function guardedStep<T>(name: string, body: () => Promise<T>): Promise<T> {
  try {
    return await body()
  } catch {
    throw new Error(`${name}: ${HIDDEN_FAILURE}`)
  }
}
