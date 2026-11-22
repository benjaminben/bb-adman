// T3b (spec/phases/design-wave.md; spec/app-style-parts.md, "StatusMark"): a dot or an icon plus
// at most two words. Colour is never alone; a mark that is not clickable is a span with the tip
// in `title` (and for a screen reader); a clickable one is a button named by its tip.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusMark, type StatusTone } from '@/renderer/ui/status-mark'
import styles from '@/renderer/ui/status-mark/status-mark.module.css'
import iconStyles from '@/renderer/ui/icon/icon.module.css'
import { axeViolations } from '../render'

const CSS = fs
  .readFileSync(path.resolve('src/renderer/ui/status-mark/status-mark.module.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (name: string) => CSS.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

describe('StatusMark tones [T3b]', () => {
  it.each<[StatusTone, string]>([
    ['none', '--color-text-muted'],
    ['ok', '--color-ok'],
    ['warn', '--color-warn'],
    ['danger', '--color-danger'],
    ['info', '--color-info'],
    ['accent', '--color-accent'],
    ['running', '--color-accent'],
  ])('%s sets its class and the colour %s', (tone, token) => {
    render(<StatusMark tone={tone} label="Mark" tip="Mark" />)
    const mark = screen.getByTitle('Mark')
    expect(mark).toHaveClass(styles[tone] as string)
    expect(rule(tone)).toMatch(new RegExp(`color:\\s*var\\(${token}\\)`))
  })

  it('draws the dot and icon at the mark sizes, the label in the meta type with tabular numbers', () => {
    expect(rule('dot')).toMatch(/width:\s*var\(--mark-dot\)/)
    expect(CSS).toMatch(/width:\s*var\(--mark-icon\)/)
    expect(rule('label')).toMatch(/font-size:\s*var\(--type-meta-size\)/)
    expect(rule('label')).toMatch(/tabular-nums/)
  })
})

describe('StatusMark that is not clickable [T3b]', () => {
  it('is a span with the tip in title, not focusable', () => {
    render(<StatusMark tone="ok" label="Connected" tip="Connected" icon="check" />)
    const mark = screen.getByTitle('Connected')
    expect(mark.tagName).toBe('SPAN')
    expect(mark).not.toHaveAttribute('tabindex')
    expect(screen.queryByRole('button')).toBeNull()
    expect(mark.querySelector('svg')).not.toBeNull()
    expect(mark).toHaveTextContent(/^Connected$/)
  })

  it('gives a screen reader the tip when it says more than the label', () => {
    const tip = 'Key saved, ends in 4821. Replace'
    render(<StatusMark tone="ok" label="•••4821" tip={tip} />)
    const mark = screen.getByTitle(tip)
    expect(mark).toHaveTextContent('•••4821')
    expect(screen.getByText(tip)).toHaveClass(styles.hidden as string)
  })

  it('renders a dot with no label with its tip as accessible text', () => {
    render(<StatusMark tone="accent" tip="New result" />)
    const mark = screen.getByTitle('New result')
    expect(mark.querySelector(`.${styles.dot as string}`)).not.toBeNull()
    expect(screen.getByText('New result')).toHaveClass(styles.hidden as string)
  })

  it('draws the given icon in place of the dot', () => {
    render(
      <StatusMark tone="danger" label="Failed" tip="The bucket refused the key" icon="xCircle" />,
    )
    const mark = screen.getByTitle('The bucket refused the key')
    expect(mark.querySelector('svg')).not.toBeNull()
    expect(mark.querySelector(`.${styles.dot as string}`)).toBeNull()
  })
})

describe('StatusMark that is clickable [T3b]', () => {
  it('is a button named by the tip that calls onClick', async () => {
    const onClick = vi.fn()
    const tip = 'Key saved, ends in 4821. Replace'
    render(<StatusMark tone="ok" label="•••4821" tip={tip} onClick={onClick} />)
    const button = screen.getByRole('button', { name: tip })
    expect(button).toHaveAttribute('title', tip)
    expect(button).toHaveAttribute('type', 'button')
    await userEvent.tab()
    expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(2)
  })
})

describe('StatusMark running [T3b]', () => {
  it('draws the turning spinner icon whatever icon is given', () => {
    render(<StatusMark tone="running" label="Checking" tip="Checking the key" icon="check" />)
    const svg = screen.getByTitle('Checking the key').querySelector('svg')
    expect(svg).toHaveClass(iconStyles.spin as string)
  })

  it('does not turn the icon a second time, so reduce motion stops the turn', () => {
    expect(CSS).not.toMatch(/animation|transform/)
  })
})

describe('StatusMark accessibility [T3b]', () => {
  it('passes axe for each kind', async () => {
    render(
      <main>
        <p>
          <StatusMark tone="none" label="Not set" tip="Not set" />
          <StatusMark tone="ok" label="Connected" tip="Connected in 0.4 seconds" icon="check" />
          <StatusMark
            tone="warn"
            label="Paid"
            tip="Each run is charged to your account"
            icon="coin"
          />
          <StatusMark tone="accent" tip="New result" />
          <StatusMark tone="running" label="Running" tip="Making 4 pictures" />
          <StatusMark
            tone="ok"
            label="•••4821"
            tip="Key saved, ends in 4821. Replace"
            onClick={() => {}}
          />
        </p>
      </main>,
    )
    expect(await axeViolations()).toEqual([])
  })
})
