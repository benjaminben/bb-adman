// ui/paid-confirm/ (design wave CAMP-7: moved from the campaign page): the two-step paid line
// that Retry on an activity row and Translate in the sync review use (C-15). Its CSS module is
// marked; the line is an info notice with a hidden icon, its words as given and its two
// buttons in their order; nothing is sent before Confirm. Holds the paid confirm case of the
// campaign page's run-panels-style test.
import fs from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PaidConfirm, paidLine } from '@/renderer/ui/paid-confirm'
import layout from '@/renderer/ui/layout.module.css'

const FOLDER = path.resolve('src/renderer/ui/paid-confirm')

describe('PaidConfirm [ST-12, C-15]', () => {
  it('marks its CSS module', () => {
    const css = fs.readdirSync(FOLDER).filter((name) => name.endsWith('.css'))
    expect(css).not.toEqual([])
    for (const name of css) {
      const first = fs.readFileSync(path.join(FOLDER, name), 'utf8').split('\n')[0]
      expect(first, name).toBe('/* app-style */')
    }
  })

  it('draws the paid confirm line as an info notice, words and buttons unchanged', () => {
    render(
      <PaidConfirm
        count={2}
        providerLabel="Made-up Cloud"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )
    const text = paidLine(2, 'Made-up Cloud')
    const line = screen.getByText(text).parentElement!
    expect(line).toHaveClass(layout.notice as string, layout.info as string)
    expect(line.textContent).toBe(`${text}ConfirmCancel`)
    expect(line.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(
      within(line)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Confirm', 'Cancel'])
  })

  it.each([
    [2, 0, 'This sends 2 paid request(s) to Made-up Cloud.'],
    [null, 0, 'This sends paid request(s) to Made-up Cloud.'],
    [1, 3, 'This sends 1 paid request(s) and 3 reference picture(s) to Made-up Cloud.'],
  ])('words the line for count %s and %i reference pictures', (count, references, text) => {
    expect(paidLine(count, 'Made-up Cloud', references)).toBe(text)
  })

  it('calls only onConfirm on Confirm and only onCancel on Cancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <PaidConfirm
        count={1}
        providerLabel="Made-up Cloud"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
