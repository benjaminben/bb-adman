// The four single-value fields of SET-6 (choice C-4), each opened on its Settings page with
// made-up values. Each case names the field, a new value to type and the one command that value
// must send. The two addresses are not here: they keep their own Save (orchestrator's ruling).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { ExportSection } from '@/renderer/screens/settings/export-section'
import type { AppState } from '@/shared/schemas/queries/app'
import { renderApp } from '../../render'
import { makeFakeApi, baseState } from '../../fake-api'
import { connect, mcpFake } from './mcp-fixture'

type Fake = ReturnType<typeof makeFakeApi>
export type Opened = { fake: Fake; box: HTMLElement; field: HTMLElement }

export type Case = {
  name: string
  open: () => Promise<Opened>
  typed: string
  command: { name: string; input: unknown }
}

async function openPort(): Promise<Opened> {
  const { fake } = mcpFake(connect())
  await renderApp(<SettingsScreen page="agents" />, fake)
  const box = await screen.findByRole('region', { name: 'Agent access' })
  return { fake, box, field: await within(box).findByLabelText('Port') }
}

function dropboxState(rootPath: string): AppState {
  const base = baseState()
  return {
    ...base,
    settings: {
      ...base.settings,
      storage: { s3: null, dropbox: { accountName: 'Ann Example', rootPath } },
    },
    secrets: [{ name: 'dropbox.refreshToken', lastFour: '' }],
  }
}

async function openFolder(): Promise<Opened> {
  const fake = makeFakeApi(dropboxState('Adman'))
  const { store } = await renderApp(<SettingsScreen page="publish" />, fake)
  store.getState().subscribe()
  const box = await screen.findByRole('group', { name: 'Dropbox' })
  await userEvent.click(within(box).getByRole('button', { name: 'Dropbox', expanded: false }))
  return { fake, box, field: within(box).getByLabelText('Folder in the app folder') }
}

function exportState(): AppState {
  const base = baseState()
  return {
    ...base,
    settings: {
      ...base.settings,
      export: { ...base.settings.export, imageFormat: 'jpg', jpgQuality: 90 },
      reports: { exporterName: 'Ann Example' },
    },
  }
}

async function openExport(label: string): Promise<Opened> {
  const fake = makeFakeApi(exportState())
  await renderApp(<ExportSection />, fake)
  const box = await screen.findByRole('region', { name: 'Export' })
  return { fake, box, field: within(box).getByLabelText(label) }
}

export const CASES: Case[] = [
  {
    name: 'Port',
    open: openPort,
    typed: '48000',
    command: { name: 'settings.update', input: { mcp: { port: 48000 } } },
  },
  {
    name: 'Dropbox Folder',
    open: openFolder,
    typed: ' Spring ads ',
    command: { name: 'storage.setDropboxFolder', input: { rootPath: 'Spring ads' } },
  },
  {
    name: 'JPG quality',
    open: () => openExport('JPG quality'),
    typed: '75',
    command: { name: 'settings.update', input: { export: { jpgQuality: 75 } } },
  },
  {
    name: 'Report name',
    open: () => openExport('Report name'),
    typed: 'Bo Sample',
    command: { name: 'settings.update', input: { reports: { exporterName: 'Bo Sample' } } },
  },
]

export const sentOf = (fake: Fake, name: string) => fake.commands.filter((c) => c.name === name)

export { openPort, openFolder, openExport, dropboxState }
