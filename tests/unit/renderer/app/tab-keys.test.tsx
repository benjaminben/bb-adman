// spec/editor.md, "Keys for the tabs" [FR-242, A-23]: Ctrl+Tab and Ctrl+Shift+Tab step through
// the variant tabs, Mod+Shift+] and Mod+Shift+[ through the campaign tabs. "Overview" and
// "Project" count as tabs. Both wrap round and work from inside a text field. jsdom is not a
// Mac, so Mod is Ctrl here.
import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { useTabKeys } from '@/renderer/app/campaign-tabs'
import { NavScope, useNav, useNavStore } from '@/renderer/app/nav-context'
import { campaignNav, projectNav } from '@/renderer/stores/nav-store'

function Harness() {
  const nav = useNavStore()
  useEffect(() => {
    const s = nav.getState()
    s.openCampaign('P1', 'C1')
    s.openCampaign('P1', 'C2')
    s.openVariant('P1', 'C2', 'V1')
    s.openVariant('P1', 'C2', 'V2')
    s.showVariant('P1', 'C2', 'overview')
  }, [nav])
  useTabKeys('P1')
  const campaign = useNav((s) => projectNav(s, 'P1').shown)
  const variant = useNav((s) => campaignNav(s, 'P1', campaign).shown)
  return (
    <main>
      <label>
        Copy
        <input />
      </label>
      <p>{`campaign ${campaign}, variant ${variant}`}</p>
    </main>
  )
}

function draw() {
  render(
    <NavScope>
      <Harness />
    </NavScope>,
  )
}

const NEXT_VARIANT = { code: 'Tab', ctrlKey: true }
const PREVIOUS_VARIANT = { code: 'Tab', ctrlKey: true, shiftKey: true }
const NEXT_CAMPAIGN = { code: 'BracketRight', ctrlKey: true, shiftKey: true }
const PREVIOUS_CAMPAIGN = { code: 'BracketLeft', ctrlKey: true, shiftKey: true }

describe('tab keys [FR-242]', () => {
  it.each([
    ['next variant tab', [NEXT_VARIANT], 'campaign C2, variant V1'],
    [
      'next variant tab wraps to Overview',
      [NEXT_VARIANT, NEXT_VARIANT, NEXT_VARIANT],
      'campaign C2, variant overview',
    ],
    ['previous variant tab wraps to the last', [PREVIOUS_VARIANT], 'campaign C2, variant V2'],
    ['next campaign tab wraps to Project', [NEXT_CAMPAIGN], 'campaign project, variant overview'],
    ['previous campaign tab', [PREVIOUS_CAMPAIGN], 'campaign C1, variant overview'],
    [
      'previous campaign tab wraps to the last',
      [PREVIOUS_CAMPAIGN, PREVIOUS_CAMPAIGN, PREVIOUS_CAMPAIGN],
      'campaign C2, variant overview',
    ],
  ])('%s, even from inside a text field', (_, presses, shown) => {
    draw()
    const field = screen.getByRole('textbox', { name: 'Copy' })
    field.focus()
    for (const press of presses) {
      const event = fireEvent.keyDown(field, press)
      expect(event).toBe(false)
    }
    expect(screen.getByText(shown)).toBeInTheDocument()
  })

  it('leaves Ctrl+Tab alone on the Project tab, which has no variant tabs', () => {
    draw()
    fireEvent.keyDown(document.body, NEXT_CAMPAIGN)
    expect(fireEvent.keyDown(document.body, NEXT_VARIANT)).toBe(true)
    expect(screen.getByText('campaign project, variant overview')).toBeInTheDocument()
  })

  it('leaves other keys alone', () => {
    draw()
    expect(fireEvent.keyDown(document.body, { code: 'Tab' })).toBe(true)
    expect(fireEvent.keyDown(document.body, { code: 'BracketRight', ctrlKey: true })).toBe(true)
    expect(screen.getByText('campaign C2, variant overview')).toBeInTheDocument()
  })
})
