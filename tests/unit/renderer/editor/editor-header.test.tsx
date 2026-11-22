// spec/phases/design-wave-screens-a.md ED-5: the editor's header is one line. The title is a
// button that opens the title field (click or F2); a size chip; Format as two icon segments;
// Place text, Layout, Undo and Redo as icon buttons that keep their names. The overflow banner
// is short with its fix in an InfoTip; the missing-file line is word for word.
import '../../shared/scene/fake-fonts'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Editor } from '@/renderer/editor/editor'
import { EditorBanner } from '@/renderer/editor/editor-banner'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, V, assetRow, variantGet } from './editor-fixture'

const SCOPE = { projectId: P, scope: `variant:${V}` }
const MISSING = 'A file this variant uses cannot be found. Relink it from the project page.'

async function open(reply: VariantGet = variantGet(), history = { canUndo: true, canRedo: false }) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: reply }))
  fake.onQuery('history.state', () => ({ ok: true, data: history }))
  const view = await renderApp(<Editor projectId={P} variantId={V} />, fake)
  const canvas = await screen.findByRole('region', { name: 'Canvas, Master post' })
  return { ...view, fake, canvas }
}

const sent = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)
const titleButton = () => screen.getByRole('button', { name: 'Rename Master post' })
const titleField = () => screen.queryByRole('textbox', { name: 'Variant title' })
const format = () => within(screen.getByRole('group', { name: 'Format' }))

describe('Editor header: the title [ED-5]', () => {
  it('shows the title as a button named "Rename {title}" inside the heading', async () => {
    await open()
    expect(screen.getByRole('heading', { name: /Master post/ })).toContainElement(titleButton())
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it('a click opens the field; Enter saves once with variant.update', async () => {
    const { fake } = await open()
    await userEvent.click(titleButton())
    await userEvent.clear(titleField()!)
    await userEvent.type(titleField()!, 'Summer post{Enter}')
    expect(sent(fake, 'variant.update')).toEqual([
      { projectId: P, variantId: V, title: 'Summer post' },
    ])
    expect(titleField()).toBeNull()
  })

  it('F2 on the title opens the field; Escape cancels, keeps the title and returns focus', async () => {
    const { fake } = await open()
    titleButton().focus()
    await userEvent.keyboard('{F2}')
    await userEvent.type(titleField()!, ' draft')
    await userEvent.keyboard('{Escape}')
    expect(titleField()).toBeNull()
    expect(sent(fake, 'variant.update')).toEqual([])
    await waitFor(() => expect(titleButton()).toHaveFocus())
    expect(titleButton()).toHaveTextContent(/^Master post$/)
  })

  it('an empty title sends nothing', async () => {
    const { fake } = await open()
    await userEvent.click(titleButton())
    await userEvent.clear(titleField()!)
    await userEvent.keyboard('{Enter}')
    expect(sent(fake, 'variant.update')).toEqual([])
  })
})

describe('Editor header: marks and Format [ED-5]', () => {
  it('shows Master, and a size chip whose title holds the size label and language', async () => {
    await open()
    const bar = within(screen.getByRole('banner'))
    expect(bar.getByText('Master')).toBeInTheDocument()
    const chip = bar.getByText('1080 × 1350')
    expect(chip).toHaveAttribute('title', '4:5 · en')
    expect(bar.queryByText(/px/)).toBeNull()
  })

  it('Format is two pressed-state buttons; Video sends variant.setFormat once per click', async () => {
    const { fake } = await open()
    expect(format().getByRole('button', { name: 'Image' })).toHaveAttribute('aria-pressed', 'true')
    expect(format().getByRole('button', { name: 'Video' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(format().getByRole('button', { name: 'Image' }))
    expect(sent(fake, 'variant.setFormat')).toEqual([])
    await userEvent.click(format().getByRole('button', { name: 'Video' }))
    expect(sent(fake, 'variant.setFormat')).toEqual([
      { projectId: P, variantId: V, format: 'video' },
    ])
  })

  it('a video shows Length with the unit s, named "Length (seconds)"', async () => {
    const base = variantGet()
    await open({ ...base, variant: { ...base.variant, format: 'video', durationMs: 8000 } })
    const length = screen.getByRole('textbox', { name: 'Length (seconds)' })
    expect(length).toHaveValue('8.0')
    expect(length.parentElement).toHaveTextContent(/s$/)
    expect(screen.queryByText('Length (seconds)')).toBeNull()
    expect(await axeViolations()).toEqual([])
  })
})

describe('Editor header: icon buttons [ED-5]', () => {
  it('Place text, Layout, Undo and Redo keep their names and show no words', async () => {
    await open()
    for (const name of ['Place text with AI…', 'Layout…', 'Undo', 'Redo']) {
      const button = screen.getByRole('button', { name })
      expect(button).toHaveAttribute('title', name)
      expect(button).toHaveTextContent(/^$/)
    }
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
  })

  it('Mod+Z and Mod+Shift+Z press Undo and Redo', async () => {
    const { fake, canvas } = await open(variantGet(), { canUndo: true, canRedo: true })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled())
    canvas.focus()
    await userEvent.keyboard('{Control>}z{/Control}')
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(fake.commands.map((c) => [c.name, c.input])).toEqual([
      ['history.undo', SCOPE],
      ['history.redo', SCOPE],
    ])
  })

  it('Place text disabled has the no-text hint as its title and its description', async () => {
    await open(variantGet({ layers: [BACKGROUND, { ...HEADLINE, copy: ' ' }, LOGO] }))
    const button = screen.getByRole('button', { name: 'Place text with AI…' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', 'Add text to a text layer first.')
    expect(button).toHaveAccessibleDescription('Add text to a text layer first.')
    expect(await axeViolations()).toEqual([])
  })
})

describe('Editor banner [ED-5]', () => {
  it('the overflow line reads "2 texts do not fit" with the fix in its InfoTip', async () => {
    render(
      <main>
        <EditorBanner missingFile={false} overflowCount={2} />
      </main>,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/^2 texts do not fit$/)
    await userEvent.click(screen.getByRole('button', { name: 'About fixing it' }))
    expect(
      screen.getByText('Make the box larger, the text smaller, or shorten the text.'),
    ).toBeVisible()
    expect(await axeViolations()).toEqual([])
  })

  it('one text reads "1 text does not fit"', () => {
    render(<EditorBanner missingFile={false} overflowCount={1} />)
    expect(screen.getByRole('status')).toHaveTextContent(/^1 text does not fit$/)
  })

  it('the missing-file line is unchanged and comes first', async () => {
    const layers = [variantGet().layers[0]!, { ...HEADLINE, overflow: true }, LOGO]
    await open(variantGet({ assets: [assetRow('A1', { missing: true })], layers }))
    expect(screen.getByRole('status')).toHaveTextContent(new RegExp(`^${MISSING}$`))
  })
})

describe('Canvas footer [ED-5]', () => {
  it('has no size text; Zoom out and Zoom in are icon buttons with their names', async () => {
    const { canvas } = await open()
    expect(within(canvas).queryByText(/px/)).toBeNull()
    for (const name of ['Zoom out', 'Zoom in']) {
      const button = within(canvas).getByRole('button', { name })
      expect(button).toHaveAttribute('title', name)
      expect(button).toHaveTextContent(/^$/)
    }
    fireEvent.click(within(canvas).getByRole('button', { name: 'Zoom in' }))
    expect(within(canvas).getByTitle('Zoom to fit')).toBeInTheDocument()
  })
})
