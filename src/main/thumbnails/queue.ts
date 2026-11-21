// spec/scene.md, "The render service": one draw at a time for the whole app. A variant.render
// goes first; thumbnails after, oldest request first. A thumbnail waiting for the same project
// and variant is merged: the draw reads its input when it starts, so it draws the latest rev.
type Task = { projectId: string; variantId: string; run: () => Promise<void> }

export type DrawQueue = {
  render<T>(run: () => Promise<T>): Promise<T>
  thumbnail(projectId: string, variantId: string, run: () => Promise<void>): void
  drop(projectId: string, variantId: string): void
  dropProject(projectId: string): void
  // Settles when nothing is drawing or waiting.
  idle(): Promise<void>
}

export function createDrawQueue(): DrawQueue {
  const renders: Array<() => Promise<void>> = []
  let thumbnails: Task[] = []
  let busy = false
  let waiters: Array<() => void> = []

  function next(): void {
    if (busy) return
    const run = renders.shift() ?? thumbnails.shift()?.run
    if (!run) {
      for (const w of waiters) w()
      waiters = []
      return
    }
    busy = true
    void run()
      .catch(() => undefined)
      .finally(() => {
        busy = false
        next()
      })
  }

  return {
    render(run) {
      return new Promise((resolve, reject) => {
        renders.push(() => run().then(resolve, reject))
        next()
      })
    },
    thumbnail(projectId, variantId, run) {
      const waiting = thumbnails.some((t) => t.projectId === projectId && t.variantId === variantId)
      if (!waiting) thumbnails.push({ projectId, variantId, run })
      next()
    },
    drop(projectId, variantId) {
      thumbnails = thumbnails.filter((t) => t.projectId !== projectId || t.variantId !== variantId)
    },
    dropProject(projectId) {
      thumbnails = thumbnails.filter((t) => t.projectId !== projectId)
    },
    idle() {
      if (!busy && renders.length === 0 && thumbnails.length === 0) return Promise.resolve()
      return new Promise((resolve) => waiters.push(resolve))
    },
  }
}
