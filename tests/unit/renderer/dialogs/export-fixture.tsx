// The export dialog tests [P8-11]: a campaign of three ads (one a video), the folder picker
// and export.run answered by the fake window.api, and the sent inputs.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportDialog } from '@/renderer/dialogs/export-dialog'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { P, campaignGet, variant } from '../screens/campaign/campaign-fixture'

export const FOLDER = '/Users/me/Desktop/Summer handover'

export const ADS = [
  variant('V1', { title: 'Picnic table', sizeLabel: '1x1', isMaster: true }),
  variant('V2', { title: 'Picnic table', sizeLabel: '9x16', language: 'de' }),
  variant('V3', { title: 'Beach walk', sizeLabel: '9x16', format: 'video' }),
]

export const ROWS = [
  'Picnic table · 1x1 · en · image',
  'Picnic table · 9x16 · de · image',
  'Beach walk · 9x16 · en · video',
]

export const WARNED: Result<unknown> = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: 'Some ads have warnings. Fix them or export anyway.',
    details: {
      reason: 'export_has_warnings',
      warnings: [
        { variantId: 'V2', checkId: 'text-overflow', message: 'The headline runs past its box.' },
        { variantId: 'V3', checkId: 'text-colours', message: '<b>Low</b> contrast on the button.' },
      ],
    },
  },
}

export const RUNNING: Result<unknown> = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: 'This campaign is already being exported. Wait for it to finish.',
    details: { reason: 'export_running' },
  },
}

export const STARTED: Result<unknown> = { ok: true, data: { jobId: 'J9' } }

export async function openExport(
  replies: Array<Result<unknown> | Promise<Result<unknown>>> = [],
  folders: Array<string | null> = [FOLDER],
) {
  const fake = makeFakeApi()
  fake.onQuery('campaign.get', () => ({ ok: true, data: campaignGet(ADS) }))
  const picks = [...folders]
  fake.onQuery('dialog.pickFolder', () => ({ ok: true, data: { path: picks.shift() ?? null } }))
  const sends = [...replies]
  fake.onCommand('export.run', () => sends.shift() ?? STARTED)
  const onClose = () => undefined
  const view = await renderApp(
    <ExportDialog projectId={P} campaignId="C1" onClose={onClose} />,
    fake,
  )
  await screen.findByRole('checkbox', { name: ROWS[0] })
  return { ...view, fake, dialog: screen.getByRole('dialog', { name: 'Export Summer Splash' }) }
}

export function exportsSent(fake: ReturnType<typeof makeFakeApi>) {
  return fake.commands.filter((c) => c.name === 'export.run').map((c) => c.input)
}

export function input(over: Record<string, unknown> = {}) {
  return {
    projectId: P,
    campaignId: 'C1',
    variantIds: ['V1', 'V2', 'V3'],
    outputDir: FOLDER,
    imageFormat: 'png',
    jpgQuality: 90,
    fps: 30,
    proceedDespiteWarnings: false,
    ...over,
  }
}

export const button = (name: string) => screen.getByRole('button', { name })
export const click = (name: string) => userEvent.click(button(name))
export const chooseFolder = () => click('Choose folder…')
