// Runs async tasks strictly one at a time, in the order they were given. A task that
// fails does not stop the ones after it; its caller still gets the failure.
export type Serial = <T>(task: () => Promise<T>) => Promise<T>

export function createSerial(): Serial {
  let last: Promise<unknown> = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = last.then(task)
    last = next.catch(() => undefined)
    return next
  }
}
