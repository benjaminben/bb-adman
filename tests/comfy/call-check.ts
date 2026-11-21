// SPEC 6.10.12 [REQ: FR-289]: each case ends by asserting the calls it made were only the ones
// it meant to make, whether the case passed or failed. On a failed case the result is printed
// and the case's own error is kept; on a passed case a problem fails it.
import { foreignCancels, unexpectedCalls, type Call, type CallName } from './recorder'

const show = (c: Call) => `${c.name}(${c.arg ?? ''})`

export function callProblems(calls: readonly Call[], allowed: readonly CallName[]): string[] {
  const uploads = calls.filter((c) => c.name === 'uploadImage').length
  return [
    ...unexpectedCalls(calls, allowed).map((c) => `An unexpected call: ${show(c)}`),
    ...foreignCancels(calls).map((c) => `A cancel of an ID this case did not submit: ${show(c)}`),
    ...(uploads > 1 ? [`More than one upload: ${uploads}`] : []),
  ]
}

export async function withCallCheck<T>(
  calls: readonly Call[],
  allowed: readonly CallName[],
  print: (...lines: string[]) => void,
  body: () => Promise<T>,
): Promise<T> {
  const report = () => {
    const problems = callProblems(calls, allowed)
    print(...(problems.length ? problems : ['Calls made: only the ones this case meant to make.']))
    return problems
  }
  let value: T
  try {
    value = await body()
  } catch (error) {
    // A failed case: the calls are still checked and printed, and its own error is kept.
    report()
    throw error
  }
  if (report().length) throw new Error('The case made calls it did not mean to make')
  return value
}
