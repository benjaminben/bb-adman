// T3e (spec/phases/design-wave.md; spec/app-style-parts.md, "SideList"): the settings page list
// (C-1). A nav of buttons, the current one marked as the page; a mark adds a dot and hidden
// words; the foot comes after the list.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SideList, type SideListProps } from '@/renderer/ui/side-list'
import { axeViolations } from '../render'

const ITEMS: SideListProps['items'] = [
  { id: 'ai', label: 'AI services', icon: 'sparkle' },
  { id: 'files', label: 'Files', icon: 'folder', mark: 'warn' },
  { id: 'publish', label: 'Publish', icon: 'cloud', mark: 'danger' },
  { id: 'agents', label: 'Agents', icon: 'bot' },
]

function draw(foot?: SideListProps['foot']) {
  const onChoose = vi.fn()
  render(
    <main>
      <SideList label="Settings pages" items={ITEMS} current="ai" onChoose={onChoose} foot={foot} />
    </main>,
  )
  return onChoose
}

describe('SideList [T3e]', () => {
  it('is a nav with its label holding one button per item', () => {
    draw()
    const nav = screen.getByRole('navigation', { name: 'Settings pages' })
    expect(within(nav).getAllByRole('button')).toHaveLength(4)
  })

  it('marks the current item only with aria-current="page"', () => {
    draw()
    expect(screen.getByRole('button', { name: 'AI services' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const others = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-current'))
    expect(others).toHaveLength(1)
  })

  it('calls onChoose with the id on a click', async () => {
    const onChoose = draw()
    await userEvent.click(screen.getByRole('button', { name: /^Agents/ }))
    expect(onChoose).toHaveBeenCalledWith('agents')
  })

  it.each(['Files', 'Publish'])(
    'a mark adds a dot and the hidden words "needs a look" (%s)',
    (label) => {
      draw()
      const button = screen.getByRole('button', { name: `${label}, needs a look` })
      expect(within(button).getByText('needs a look', { exact: false })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Agents' })).toBeInTheDocument()
    },
  )

  it('draws the foot after the list', () => {
    draw(<button type="button">Setup</button>)
    const list = screen.getByRole('list')
    const foot = screen.getByRole('button', { name: 'Setup' })
    expect(list.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(list).not.toContainElement(foot)
  })

  it('passes axe', async () => {
    draw(<button type="button">Setup</button>)
    expect(await axeViolations()).toEqual([])
  })
})
