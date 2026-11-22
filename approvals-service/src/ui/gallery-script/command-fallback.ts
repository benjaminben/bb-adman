// spec/phases/round-2-approvals.md "The lightbox (item 22)": HTML's command buttons open and
// close the dialogs without script. Only in a browser without them (no `commandForElement` on
// buttons) does a click on a `[commandfor]` button call `showModal()` or `close()` itself.

// The page's parts this module uses, by shape: the test project compiles this file without the
// browser's types.
type Button = { disabled: boolean; getAttribute(name: string): string | null }
type Dialog = { readonly open: boolean; showModal(): void; close(): void }
type Click = { target: { closest?(selectors: string): unknown } | null }
export type FallbackPage = {
  document: {
    addEventListener(type: 'click', listener: (event: Click) => void): void
    removeEventListener(type: 'click', listener: (event: Click) => void): void
    getElementById(id: string): unknown
  }
  HTMLButtonElement: (abstract new () => Button) & { prototype: Button }
  HTMLDialogElement: abstract new () => Dialog
}

type Action = 'showModal' | 'close'

// The dialog call for a button's `command`, or null for any other command.
export function commandAction(command: string | null): Action | null {
  if (command === 'show-modal') return 'showModal'
  if (command === 'close') return 'close'
  return null
}

export function startCommandFallback(page: FallbackPage): () => void {
  if ('commandForElement' in page.HTMLButtonElement.prototype) return () => {}
  const { document } = page

  const onClick = (event: Click) => {
    const button = event.target?.closest?.('button[commandfor]')
    if (!(button instanceof page.HTMLButtonElement) || button.disabled) return
    const action = commandAction(button.getAttribute('command'))
    const dialog = document.getElementById(button.getAttribute('commandfor') ?? '')
    if (action === null || !(dialog instanceof page.HTMLDialogElement)) return
    if (action === 'showModal' && !dialog.open) dialog.showModal()
    if (action === 'close' && dialog.open) dialog.close()
  }

  document.addEventListener('click', onClick)
  return () => document.removeEventListener('click', onClick)
}
