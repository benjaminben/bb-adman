// The approvals row's "Amazon S3" link asks the S3 row on the same page to open and take focus
// (SET-4). Nothing is stored; a row that is not drawn simply does not hear it.
type Listener = () => void

const listeners = new Set<Listener>()

export function revealS3Row() {
  for (const listener of listeners) listener()
}

export function onRevealS3Row(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// Opens the folded Section around an element by its own fold button, so the fold memory stays
// the Section's.
export function openSectionAround(element: HTMLElement | null) {
  const body = element?.closest<HTMLElement>('[hidden]')
  if (body === null || body === undefined || body.id === '') return
  const toggles = Array.from(document.querySelectorAll<HTMLElement>('[aria-controls]'))
  toggles.find((t) => t.getAttribute('aria-controls') === body.id)?.click()
}
