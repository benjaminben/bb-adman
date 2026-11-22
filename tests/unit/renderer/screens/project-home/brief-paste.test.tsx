// R2P-4 (spec/phases/round-2-platform.md, D4): "Paste a brief" opens a dialog with one text
// area. "Read brief" sends brief.parse with the text; a refusal stays in the dialog with the
// text kept; a read brief closes it and follows the loaded brief's flow (SP-4).
import { describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BRIEF_TEXT_UNREADABLE } from '@/shared/brief/text'
import { NavScope, useNewCampaignAsk } from '@/renderer/app/nav-context'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { axeViolations, renderApp } from '../../render'
import { PROJECT } from './project-fixture'
import { PATHS, briefApi, imports, openPage, photoNames, sent } from './brief-load-photos-fixture'

const MARKDOWN = '# Spring Glow launch\n\n**Region:** France\n'
const UNREADABLE = BRIEF_TEXT_UNREADABLE.message

async function openDialog(fake = briefApi().fake) {
  await openPage(fake)
  await userEvent.click(screen.getByRole('button', { name: 'Paste a brief' }))
  const dialog = await screen.findByRole('dialog', { name: 'Paste a brief' })
  return { fake, dialog }
}

async function paste(dialog: HTMLElement, text: string) {
  await userEvent.click(within(dialog).getByLabelText('Brief text'))
  await userEvent.paste(text)
}

const readButton = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: 'Read brief' })

describe('"Paste a brief" [R2P-4, D4]', () => {
  it('shows the text area with its placeholder, and "Read brief" only works once there is text', async () => {
    const { fake, dialog } = await openDialog()
    const area = within(dialog).getByLabelText('Brief text')
    expect(area).toHaveAttribute('placeholder', 'JSON, YAML or Markdown')
    expect(area).toHaveFocus()
    expect(readButton(dialog)).toBeDisabled()
    await paste(dialog, '  \n\t ')
    expect(readButton(dialog)).toBeDisabled()
    await paste(dialog, MARKDOWN)
    expect(readButton(dialog)).toBeEnabled()
    expect(sent(fake, 'brief.parse')).toEqual([])
  })

  it('shows a refusal in the dialog and keeps the text', async () => {
    const { fake } = briefApi()
    fake.onCommand('brief.parse', () => ({ ok: false, error: BRIEF_TEXT_UNREADABLE }))
    const { dialog } = await openDialog(fake)
    await paste(dialog, 'just some words')
    await userEvent.click(readButton(dialog))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(UNREADABLE)
    expect(within(dialog).getByLabelText('Brief text')).toHaveValue('just some words')
    expect(sent(fake, 'brief.parse')).toEqual([{ projectId: 'P1', text: 'just some words' }])
    expect(screen.queryByRole('region', { name: 'New campaign' })).toBeNull()
  })

  it('closes on a read brief, adds its photos and opens the form filled from it', async () => {
    const { fake, dialog } = await openDialog()
    await paste(dialog, MARKDOWN)
    await userEvent.click(readButton(dialog))
    const form = await screen.findByRole('region', { name: 'New campaign' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sent(fake, 'brief.parse')).toEqual([{ projectId: 'P1', text: MARKDOWN }])
    expect(imports(fake).map((i) => i.paths)).toEqual([[PATHS[0]], [PATHS[1]]])
    expect(within(form).getByLabelText('Campaign name')).toHaveValue('Summer Splash')
    await waitFor(() => expect(within(form).getByLabelText('Campaign name')).toHaveFocus())
    await waitFor(() => expect(photoNames(form, 1)).toEqual(['can.png']))
  })

  it('"Start from an empty form" opens the empty form and sends nothing', async () => {
    const { fake, dialog } = await openDialog()
    await paste(dialog, MARKDOWN)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start from an empty form' }))
    const form = await screen.findByRole('region', { name: 'New campaign' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(form).getByLabelText('Campaign name')).toHaveValue('')
    expect(fake.commands).toEqual([])
  })

  it('"Cancel" closes the dialog and sends nothing', async () => {
    const { fake, dialog } = await openDialog()
    await paste(dialog, MARKDOWN)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Paste a brief' })).toBeInTheDocument()
    expect(fake.commands).toEqual([])
  })

  it('closes for the "+" ask and opens the empty form with the focus in it [R2-Q C]', async () => {
    let ask: (projectId: string | null) => void = () => {}
    function Plus() {
      ask = useNewCampaignAsk().ask
      return null
    }
    await renderApp(
      <NavScope>
        <Plus />
        <ProjectHome project={PROJECT} />
      </NavScope>,
      briefApi().fake,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Paste a brief' }))
    await screen.findByRole('dialog', { name: 'Paste a brief' })
    act(() => ask('P1'))
    const form = await screen.findByRole('region', { name: 'New campaign' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(within(form).getByLabelText('Campaign name')).toHaveFocus())
    await userEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('has no axe violations with the dialog open', async () => {
    await openDialog()
    expect(await axeViolations()).toEqual([])
  })
})
