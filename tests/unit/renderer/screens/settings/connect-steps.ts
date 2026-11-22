// SET-5: steps for the folded "Connect to Claude" Section of the Agents page. The fold memory
// lasts for the test file, so the Section is opened only when it is closed. Nothing here prints
// the made-up token.
import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// The Connect Section inside Agent access, opened.
export async function openConnect(box: HTMLElement): Promise<HTMLElement> {
  const panel = await within(box).findByRole('region', { name: 'Connect to Claude' })
  const head = within(panel).getByRole('button', { name: 'Connect to Claude' })
  if (head.getAttribute('aria-expanded') !== 'true') await userEvent.click(head)
  return panel
}

// The Connect Section opened and its token shown.
export async function showToken(box: HTMLElement): Promise<HTMLElement> {
  const panel = await openConnect(box)
  const show = within(panel).queryByRole('button', { name: 'Show' })
  if (show !== null) await userEvent.click(show)
  return panel
}
