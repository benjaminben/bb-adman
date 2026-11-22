// ST-9 (spec/app-style.md "Component by component", "AI panels and the run dialog"): the
// prompt is in the reading face, reference pickers are a grid of option squares, the run dialog
// draws its buttons as the foot band, its provider choice as selectable rows and its paid count
// as an info badge, and the run failure and close warning are danger and warn notices. Every
// module of the slice carries the app-style mark. Names, words and focus stay as they are.
import fs from 'node:fs'
import path from 'node:path'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RunDialog } from '@/renderer/dialogs/run-dialog'
import { GenerateFields } from '@/renderer/editor/generate-fields'
import { useCloseWarning } from '@/renderer/ui/close-warning'
import { RunFailure } from '@/renderer/ui/run-failure'
import { attachedStoreFor, variantJobs } from '@/renderer/stores/attached-store'
import frame from '@/renderer/ui/dialog-frame/dialog-frame.module.css'
import layout from '@/renderer/ui/layout.module.css'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { campaignApi } from '../screens/campaign/campaign-fixture'
import { jobRow } from '../stores/job-fixture'
import { LOGO, P } from './editor-fixture'

const RENDERER = path.resolve('src/renderer')
const read = (file: string) => fs.readFileSync(path.join(RENDERER, file), 'utf8')
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

// The declarations of the first rule whose selector list is exactly `selector`.
function rule(css: string, selector: string): string {
  for (const m of bare(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = (m[1] ?? '').replace(/\s+/g, ' ').trim()
    if (sel === selector) return m[2] ?? ''
  }
  return ''
}

const MODULES = [
  'editor/generate-fields/generate-fields.module.css',
  'editor/generate-panel/generate-panel.module.css',
  'editor/earlier-options/earlier-options.module.css',
  'dialogs/run-dialog/run-dialog.module.css',
  'ui/paid-count/paid-count.module.css',
  'ui/run-failure/run-failure.module.css',
  'ui/reference-picker/reference-picker.module.css',
  'ui/close-warning/close-warning.module.css',
]

const has = (el: Element, ...names: (string | undefined)[]) =>
  names.forEach((n) => expect(el).toHaveClass(n as string))

async function runDialog() {
  const fake = makeFakeApi()
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: { address: null, workflows: [], leavesOnServer: [] },
  }))
  fake.onQuery('campaign.paidCount', () => ({
    ok: true,
    data: { pictures: 2, videos: 0, text: 0 },
  }))
  await renderApp(
    <RunDialog
      open
      projectId="P1"
      campaignId="C1"
      job="image"
      title="Make pictures"
      confirmLabel="Generate"
      onConfirm={async () => ({ ok: true, data: null })}
      onCancel={() => {}}
    />,
    fake,
  )
  await screen.findByRole('dialog', { name: 'Make pictures' })
  await act(async () => {})
}

function WarningHarness() {
  const { ask, warning } = useCloseWarning('tab')
  return (
    <main>
      <h1>Campaign</h1>
      <button
        type="button"
        onClick={() =>
          ask(
            (s) => variantJobs(s, 'P1', ['V1']),
            () => {},
          )
        }
      >
        Close tab
      </button>
      {warning}
    </main>
  )
}

describe('AI in the editor and the run dialog take the look [ST-9]', () => {
  it.each(MODULES.map((m) => [m]))('%s carries the app-style mark', (file) => {
    expect(read(file).startsWith('/* app-style */')).toBe(true)
  })

  it('sets the prompt in the reading face', async () => {
    const fake = campaignApi()
    fake.onQuery('asset.list', () => ({ ok: true, data: [] }))
    await renderApp(
      <main>
        <GenerateFields projectId={P} campaignId="C1" layer={LOGO} />
      </main>,
      fake,
    )
    // ED-4a: the reference strip shows once the layer's first draft is made.
    await screen.findByRole('list', { name: 'Reference pictures' })
    expect(layout.reading).toBeTruthy()
    has(screen.getByRole('textbox', { name: 'Prompt' }), layout.reading)
  })

  it('lays reference pictures in a grid of option squares, ticked ones edged in the spot colour', () => {
    const css = read('ui/reference-picker/reference-picker.module.css')
    expect(rule(css, '.grid')).toMatch(/grid-template-columns:.*var\(--option-thumb\)/)
    expect(rule(css, '.tile:has(input:checked) .thumb')).toMatch(/var\(--color-accent\)/)
  })

  it('draws the provider choice as rows, the chosen one on the soft spot ground', () => {
    const css = read('dialogs/run-dialog/run-dialog.module.css')
    expect(rule(css, '.choice:has(input:checked)')).toMatch(/var\(--color-accent-soft\)/)
  })

  it('puts the run buttons in the foot band and the paid count in an info badge', async () => {
    await runDialog()
    const generate = screen.getByRole('button', { name: 'Generate' })
    expect(generate.closest(`.${frame.foot}`)).not.toBeNull()
    has(generate, layout.primary)
    // DLG-4a: the paid count is a mark; today's full sentence is its tooltip.
    const paid = await screen.findByTitle(/^Paid generations for this campaign so far/)
    expect(paid).toHaveTextContent(/^Paid so far: /)
    expect(await axeViolations()).toEqual([])
  })

  it('draws a run failure as a danger notice', async () => {
    const row = jobRow('J1', { status: 'failed', provider: 'fake', errorKind: 'other' })
    const { container } = await renderApp(
      <main>
        <RunFailure row={row} projectId="P1" provider={undefined} providerLabel="Fake provider" />
      </main>,
      makeFakeApi(),
    )
    has(container.querySelector('main > div')!, layout.notice, layout.danger)
  })

  it('draws the close warning paid line as a warn notice, its buttons in the foot band', async () => {
    const fake = makeFakeApi(baseState())
    attachedStoreFor(fake.api).getState().register('J1', { projectId: 'P1', variantId: 'V1' })
    act(() =>
      fake.emit(
        'job.updated',
        jobRow('J1', { kind: 'image_generation', provider: 'gemini', status: 'running' }),
      ),
    )
    await renderApp(<WarningHarness />, fake)
    await userEvent.click(screen.getByRole('button', { name: 'Close tab' }))
    const keep = await screen.findByRole('button', { name: 'Keep open' })
    expect(keep).toHaveFocus()
    expect(keep.closest(`.${frame.foot}`)).not.toBeNull()
    // SH-5: the charge line is the question's warning, so it is also its description.
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleDescription('A request already sent may still be charged.')
    expect(within(dialog).getByText('A request already sent may still be charged.')).toBeVisible()
  })
})
