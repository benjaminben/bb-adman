// spec/editor.md, "Properties panel", "Text" [REQ: FR-093, FR-249]: Copy, the font slot, Size,
// Weight, Colour (hex, picker, palette), Align, Line height, Letter spacing, and the overflow line.
// Every field saves one layer.update on Enter or on leaving it, never per keystroke.
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TextFields } from '@/renderer/editor/text-fields'
import { EditorKeyRoot } from '@/renderer/editor/use-editor-key'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'
import { HEADLINE } from './editor-fixture'

const PALETTE = ['#E85D2A', '#1B1D22']

function Harness(props: { layer: LayerRow; onUpdate: () => Promise<string | null> }) {
  const root = useRef<HTMLElement>(null)
  return (
    <EditorKeyRoot.Provider value={root}>
      <main ref={root}>
        <TextFields
          layer={props.layer}
          palette={PALETTE}
          font={<p>Font slot</p>}
          onUpdate={props.onUpdate}
        />
        <button type="button">Elsewhere</button>
      </main>
    </EditorKeyRoot.Provider>
  )
}

function setup(layer: LayerRow = HEADLINE) {
  const onUpdate = vi.fn(async () => null)
  render(<Harness layer={layer} onUpdate={onUpdate} />)
  return { onUpdate }
}

const style = HEADLINE.style as { fontSize: number; lineHeight: number; letterSpacing: number }
const elsewhere = () => userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }))

describe('TextFields [spec/editor.md "Properties panel", Text]', () => {
  it.each([
    ['Size', 'spinbutton', '64', { style: { fontSize: 64 } }, '{Enter}'],
    ['Size', 'spinbutton', '64', { style: { fontSize: 64 } }, '{Tab}'],
    ['Line height', 'spinbutton', '1.35', { style: { lineHeight: 1.35 } }, '{Enter}'],
    ['Line height', 'spinbutton', '1.35', { style: { lineHeight: 1.35 } }, '{Tab}'],
    ['Letter spacing', 'spinbutton', '0.08', { style: { letterSpacing: 0.08 } }, '{Enter}'],
  ])(
    '%s sends one layer.update on %#, not per keystroke',
    async (name, role, typed, patch, key) => {
      const { onUpdate } = setup()
      const field = screen.getByRole(role, { name })
      await userEvent.clear(field)
      await userEvent.type(field, typed)
      expect(onUpdate).not.toHaveBeenCalled()
      await userEvent.keyboard(key)
      await elsewhere()
      expect(onUpdate.mock.calls).toEqual([[patch]])
    },
  )

  it('Copy saves on leaving it or with Mod+Enter; Enter adds a line', async () => {
    const { onUpdate } = setup()
    const copy = screen.getByRole('textbox', { name: 'Copy' })
    await userEvent.type(copy, '{Enter}today')
    expect(onUpdate).not.toHaveBeenCalled()
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(onUpdate.mock.calls).toEqual([[{ copy: 'Cool down this summer\ntoday' }]])
    await userEvent.type(copy, '!')
    await elsewhere()
    expect(onUpdate.mock.calls[1]).toEqual([{ copy: 'Cool down this summer\ntoday!' }])
  })

  it('letter spacing is in em, steps by 0.01 and stays within -0.2 to 1', async () => {
    const { onUpdate } = setup({ ...HEADLINE, style: { ...HEADLINE.style, letterSpacing: -0.19 } })
    const field = screen.getByRole('spinbutton', { name: 'Letter spacing' })
    expect(field).toHaveAttribute('aria-valuemin', '-0.2')
    expect(field).toHaveAttribute('aria-valuemax', '1')
    await userEvent.click(field)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onUpdate.mock.calls).toEqual([[{ style: { letterSpacing: -0.2 } }]])
    await userEvent.clear(field)
    await userEvent.type(field, '2{Enter}')
    expect(onUpdate.mock.calls[1]).toEqual([{ style: { letterSpacing: 1 } }])
  })

  it('line height stays within 0.5 to 4 and size is at least 1', async () => {
    const { onUpdate } = setup()
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Line height' }))
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Line height' }), '0.1{Enter}')
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Size' }))
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Size' }), '0{Enter}')
    expect(onUpdate.mock.calls).toEqual([
      [{ style: { lineHeight: 0.5 } }],
      [{ style: { fontSize: 1 } }],
    ])
  })

  // ED-2: the colour is a swatch field; other colours are typed in its "+" popover.
  const otherColour = () =>
    userEvent.click(
      within(screen.getByRole('group', { name: 'Colour' })).getByRole('button', {
        name: 'Other colour',
      }),
    )

  it('Colour: "Hex colour" sends one layer.update on Enter, not per keystroke', async () => {
    const { onUpdate } = setup()
    await otherColour()
    const field = screen.getByRole('textbox', { name: 'Hex colour' })
    await userEvent.clear(field)
    await userEvent.type(field, '#2A7DE8')
    expect(onUpdate).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    await elsewhere()
    expect(onUpdate.mock.calls).toEqual([[{ style: { color: '#2A7DE8' } }]])
  })

  it('a colour that is not #RRGGBB sends nothing', async () => {
    const { onUpdate } = setup()
    await otherColour()
    const field = screen.getByRole('textbox', { name: 'Hex colour' })
    await userEvent.clear(field)
    await userEvent.type(field, 'orange{Enter}')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('the colour picker saves once, when its choice is made', async () => {
    const { onUpdate } = setup()
    await otherColour()
    const picker = screen.getByLabelText('Colour picker')
    fireEvent.input(picker, { target: { value: '#112233' } })
    fireEvent.input(picker, { target: { value: '#112244' } })
    expect(onUpdate).not.toHaveBeenCalled()
    fireEvent.change(picker, { target: { value: '#112244' } })
    expect(onUpdate.mock.calls).toEqual([[{ style: { color: '#112244' } }]])
  })

  it('one button per palette colour, each sending that colour', async () => {
    const { onUpdate } = setup()
    await userEvent.click(screen.getByRole('button', { name: '#E85D2A' }))
    expect(screen.getByRole('button', { name: '#1B1D22' })).toBeInTheDocument()
    expect(onUpdate.mock.calls).toEqual([[{ style: { color: '#E85D2A' } }]])
  })

  it('Weight is a select of nine weights with its hint; a choice sends one update', async () => {
    const { onUpdate } = setup()
    const weight = screen.getByRole('combobox', { name: 'Weight' })
    expect(
      within(weight)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'Thin',
      'Extra light',
      'Light',
      'Regular',
      'Medium',
      'Semibold',
      'Bold',
      'Extra bold',
      'Black',
    ])
    // ED-2: the hint is in the InfoTip beside Weight.
    await userEvent.click(screen.getByRole('button', { name: 'About weight' }))
    expect(
      screen.getByText('Weight changes only fonts that have more than one weight.'),
    ).toBeVisible()
    await userEvent.selectOptions(weight, 'Black')
    expect(onUpdate.mock.calls).toEqual([[{ style: { fontWeight: 900 } }]])
  })

  it('Align is three pressed buttons', async () => {
    const { onUpdate } = setup()
    const group = screen.getByRole('group', { name: 'Align' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Left', 'Centre', 'Right'])
    expect(within(group).getByRole('button', { name: 'Centre' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(within(group).getByRole('button', { name: 'Right' }))
    expect(onUpdate.mock.calls).toEqual([[{ style: { align: 'right' } }]])
  })

  it('places the font field after Copy', () => {
    setup()
    const copy = screen.getByRole('textbox', { name: 'Copy' })
    const slot = screen.getByText('Font slot')
    expect(copy.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it.each([
    [true, 1],
    [false, 0],
  ])('overflow %s: the "does not fit" line shows %i times', (overflow, count) => {
    setup({ ...HEADLINE, overflow })
    expect(screen.queryAllByText('This text does not fit its box.')).toHaveLength(count)
  })

  it('a locked layer disables every field', () => {
    setup({ ...HEADLINE, locked: true })
    const main = screen.getByRole('main')
    const controls = main.querySelectorAll('input, textarea, select, fieldset button')
    expect(controls.length).toBeGreaterThan(10)
    for (const control of controls) expect(control).toBeDisabled()
  })

  it('shows the stored values', () => {
    setup()
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toHaveValue(String(style.fontSize))
    expect(screen.getByRole('spinbutton', { name: 'Line height' })).toHaveValue(
      String(style.lineHeight),
    )
  })

  it('has no accessibility violations', async () => {
    setup({ ...HEADLINE, overflow: true })
    expect(await axeViolations()).toEqual([])
  })
})

// P4-17 (spec/screens-ai.md, "Copy options") [REQ: FR-045]: "Suggest copy…" beside Copy.
describe('TextFields: Suggest copy [spec/screens-ai.md "Copy options"]', () => {
  const TAGLINE = { ...HEADLINE, id: 'L3', name: 'Tagline', slot: 'tag' }

  it.each([
    ['the headline slot', 'hidden', { ...TAGLINE, slot: 'headline' }],
    ['an unlocked text layer', 'enabled', TAGLINE],
    ['a locked text layer', 'disabled', { ...TAGLINE, locked: true }],
  ])('for %s the button is %s', (_, state, layer) => {
    setup(layer)
    const button = screen.queryByRole('button', { name: 'Suggest copy…' })
    if (state === 'hidden') expect(button).toBeNull()
    else if (state === 'enabled') expect(button).toBeEnabled()
    else expect(button).toBeDisabled()
  })

  it('sits beside the Copy field and opens the copy options dialog', async () => {
    const fake = makeFakeApi()
    const { store } = await renderApp(
      <Harness layer={TAGLINE} onUpdate={vi.fn(async () => null)} />,
      fake,
    )
    act(() => store.getState().show({ kind: 'project', projectId: 'P1' }))
    const button = screen.getByRole('button', { name: 'Suggest copy…' })
    const copy = screen.getByRole('textbox', { name: 'Copy' })
    expect(copy.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    await userEvent.click(button)
    expect(
      await screen.findByRole('dialog', { name: 'Copy options for Tagline' }),
    ).toBeInTheDocument()
    expect(fake.queries).toContainEqual({
      name: 'job.list',
      input: { projectId: 'P1', layerId: 'L3' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('TextFields: Copy on a translation [P6-14, A-162]', () => {
  const JAPANESE = {
    ...HEADLINE,
    translationStatus: 'proposed' as const,
    translationSource: 'ai' as const,
  }

  async function shown(layer: LayerRow, fake = makeFakeApi()) {
    const onUpdate = vi.fn(async () => null)
    const { store } = await renderApp(<Harness layer={layer} onUpdate={onUpdate} />, fake)
    act(() => store.getState().show({ kind: 'project', projectId: 'P1' }))
    return { fake, onUpdate }
  }

  it('a layer with no translation status still sends layer.update and shows no status', async () => {
    const { fake, onUpdate } = await shown(HEADLINE)
    await userEvent.type(screen.getByRole('textbox', { name: 'Copy' }), '!')
    await elsewhere()
    expect(onUpdate.mock.calls).toEqual([[{ copy: 'Cool down this summer!' }]])
    expect(fake.commands).toEqual([])
    expect(screen.queryByText(/^Translation:/)).toBeNull()
  })

  it('a translated layer sends translation.set and shows its status under Copy', async () => {
    const { fake, onUpdate } = await shown(JAPANESE)
    const copy = screen.getByRole('textbox', { name: 'Copy' })
    const status = screen.getByText('Translation: Proposed, from AI')
    expect(copy.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await userEvent.type(copy, '!')
    await elsewhere()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(fake.commands).toEqual([
      {
        name: 'translation.set',
        input: {
          projectId: 'P1',
          layerId: 'L1',
          text: 'Cool down this summer!',
          applyToSameLanguage: false,
        },
      },
    ])
  })

  it('a refused translation.set shows its message under Copy', async () => {
    const fake = makeFakeApi()
    fake.onCommand('translation.set', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Translations are for text layers.' },
    }))
    await shown(JAPANESE, fake)
    await userEvent.type(screen.getByRole('textbox', { name: 'Copy' }), '!')
    await elsewhere()
    expect(await screen.findByText('Translations are for text layers.')).toBeInTheDocument()
  })
})
