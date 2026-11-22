// T3b (spec/phases/design-wave.md; spec/app-style-parts.md, "InfoTip"): a small info button
// that opens a popover of plain help. Escape, a click outside or a second click closes it; focus
// stays on the button; one InfoTip is open at a time.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InfoTip } from '@/renderer/ui/info-tip'
import { axeViolations } from '../render'

const HELP = 'Pictures you publish are copied to this bucket.'
const REGION_HELP = 'The region your bucket lives in, for example eu-west-1.'

function draw() {
  return render(
    <main>
      <p>Outside words</p>
      <InfoTip about="cloud storage">{HELP}</InfoTip>
      <InfoTip about="region">{REGION_HELP}</InfoTip>
    </main>,
  )
}

const tip = (about = 'cloud storage') => screen.getByRole('button', { name: `About ${about}` })

describe('InfoTip [T3b]', () => {
  it('is a button named "About {about}", closed, with the same title', () => {
    draw()
    expect(tip()).toHaveAttribute('aria-expanded', 'false')
    expect(tip()).toHaveAttribute('title', 'About cloud storage')
    expect(screen.getByText(HELP)).not.toBeVisible()
    const controls = document.getElementById(tip().getAttribute('aria-controls') ?? '')
    expect(controls).toHaveTextContent(HELP)
  })

  it('opens on a click, showing the words', async () => {
    draw()
    await userEvent.click(tip())
    expect(tip()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(HELP)).toBeVisible()
  })

  it('opens from the keyboard with Enter and with Space', async () => {
    draw()
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(tip()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Enter}')
    expect(tip()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard(' ')
    expect(tip()).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes on Escape with focus on the button', async () => {
    draw()
    await userEvent.click(tip())
    await userEvent.keyboard('{Escape}')
    expect(tip()).toHaveAttribute('aria-expanded', 'false')
    expect(tip()).toHaveFocus()
  })

  it('closes on a click outside', async () => {
    draw()
    await userEvent.click(tip())
    await userEvent.click(screen.getByText('Outside words'))
    expect(tip()).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays open on a click on its own words, and a second click on the button closes it', async () => {
    draw()
    await userEvent.click(tip())
    await userEvent.click(screen.getByText(HELP))
    expect(tip()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(tip())
    expect(tip()).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens while the pointer rests on it and closes when it leaves', async () => {
    draw()
    await userEvent.hover(tip())
    expect(tip()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.unhover(tip())
    expect(tip()).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the first InfoTip when a second opens', async () => {
    draw()
    await userEvent.click(tip())
    await userEvent.click(tip('region'))
    expect(tip()).toHaveAttribute('aria-expanded', 'false')
    expect(tip('region')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(HELP)).not.toBeVisible()
  })

  it('passes axe open', async () => {
    draw()
    await userEvent.click(tip())
    expect(await axeViolations()).toEqual([])
  })
})
