// SET-6 (choice C-4): a field that holds one value saves on Enter or when focus leaves it, sends
// the same command its button did, once, and shows "Saved" for 2 seconds. The two addresses keep
// their own Save and are never saved by leaving (orchestrator's ruling). Made-up values only.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import type { AppState } from '@/shared/schemas/queries/app'
import { renderApp } from '../../render'
import { makeFakeApi, baseState } from '../../fake-api'
import { comfyFake } from './comfy-fixture'
import { refused } from './mcp-fixture'
import { CASES, openExport, openFolder, openPort, sentOf } from './single-value-cases'

const SAVE_BUTTONS = /^Save( port| folder)?$/

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
})

async function retype(field: HTMLElement, text: string) {
  await userEvent.clear(field)
  await userEvent.type(field, text)
}

describe.each(CASES)('single-value save: $name [SET-6, C-4]', (c) => {
  it('typing then Enter sends the command once, and leaving after sends nothing more', async () => {
    const { fake, field } = await c.open()
    await retype(field, c.typed)
    await userEvent.keyboard('{Enter}')
    expect(field).toHaveFocus()
    await userEvent.tab()
    expect(sentOf(fake, c.command.name)).toEqual([c.command])
  })

  it('typing then Tab sends the command once', async () => {
    const { fake, field } = await c.open()
    await retype(field, c.typed)
    await userEvent.tab()
    expect(sentOf(fake, c.command.name)).toEqual([c.command])
  })

  it('leaving with no change sends nothing', async () => {
    const { fake, field } = await c.open()
    await userEvent.click(field)
    await userEvent.keyboard('{Enter}')
    await userEvent.tab()
    expect(sentOf(fake, c.command.name)).toEqual([])
  })

  it('shows "Saved" after a change, gone after 2 seconds', async () => {
    const { box, field } = await c.open()
    expect(within(box).queryByText('Saved')).toBeNull()
    await retype(field, c.typed)
    await userEvent.keyboard('{Enter}')
    expect(await within(box).findByText('Saved')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2000))
    expect(within(box).queryByText('Saved')).toBeNull()
  })

  it('has no Save, Save port or Save folder button beside it', async () => {
    const { box } = await c.open()
    expect(within(box).queryByRole('button', { name: SAVE_BUTTONS })).toBeNull()
  })
})

describe('single-value save: refusals stay on the page [SET-6]', () => {
  it('a refused port keeps the typed text, shows the line, and shows no "Saved"', async () => {
    const sentence = 'Choose a port from 1024 to 65535.'
    const { fake, box, field } = await openPort()
    fake.onCommand('settings.update', () => refused(sentence))
    await retype(field, '80')
    await userEvent.keyboard('{Enter}')
    expect(await within(box).findByText(sentence)).toBeInTheDocument()
    expect(field).toHaveValue(80)
    expect(field).toHaveFocus()
    expect(within(box).queryByText('Saved')).toBeNull()
  })

  it('an empty port sends nothing', async () => {
    const { fake, field } = await openPort()
    await userEvent.clear(field)
    await userEvent.keyboard('{Enter}')
    await userEvent.tab()
    expect(sentOf(fake, 'settings.update')).toEqual([])
  })

  it('a refused Dropbox folder keeps the typed text and shows the sentence', async () => {
    const text = 'This folder name cannot be used in Dropbox.'
    const { fake, box, field } = await openFolder()
    fake.onCommand('storage.setDropboxFolder', () => refused(text, 'dropbox_folder_refused'))
    await retype(field, 'bad:name')
    await userEvent.tab()
    expect(await within(box).findByRole('alert')).toHaveTextContent(text)
    expect(field).toHaveValue('bad:name')
    expect(within(box).queryByText('Saved')).toBeNull()
  })

  it('a report name the schema refuses keeps the text, shows the line and sends nothing', async () => {
    const { fake, box, field } = await openExport('Report name')
    await retype(field, 'x'.repeat(101))
    await userEvent.keyboard('{Enter}')
    expect(field).toHaveValue('x'.repeat(101))
    expect(field).toHaveAccessibleDescription(/./)
    expect(sentOf(fake, 'settings.update')).toEqual([])
    expect(within(box).queryByText('Saved')).toBeNull()
  })
})

function approvalsState(): AppState {
  const base = baseState()
  return { ...base, settings: { ...base.settings, approvals: { baseUrl: null } } }
}

describe('single-value save: what keeps its own Save [SET-6 ruling]', () => {
  it('the ComfyUI "Server address" keeps Save, and typing then leaving sends nothing', async () => {
    const { fake } = comfyFake()
    await renderApp(<SettingsScreen />, fake)
    const box = await screen.findByRole('region', { name: 'ComfyUI server' })
    await userEvent.type(within(box).getByLabelText('Server address'), '9')
    await userEvent.tab()
    expect(fake.commands.filter((c) => c.name.startsWith('comfy.set'))).toEqual([])
    expect(within(box).getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('the approvals "Service address" keeps Save, and typing then leaving sends nothing', async () => {
    const fake = makeFakeApi(approvalsState())
    const { store } = await renderApp(<SettingsScreen page="publish" />, fake)
    store.getState().subscribe()
    const box = await screen.findByRole('region', { name: 'Approvals service' })
    await userEvent.type(within(box).getByLabelText('Service address'), 'https://made-up.example')
    await userEvent.tab()
    expect(sentOf(fake, 'approvals.setService')).toEqual([])
    expect(within(box).getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('the S3 form keeps its one Save', async () => {
    await renderApp(<SettingsScreen page="publish" />, makeFakeApi())
    const box = await screen.findByRole('group', { name: 'Amazon S3' })
    expect(within(box).getAllByRole('button', { name: 'Save' })).toHaveLength(1)
  })

  it('a key row keeps Save and Cancel', async () => {
    await renderApp(<SettingsScreen />, makeFakeApi())
    const row = screen.getByRole('group', { name: 'Google Gemini API key' })
    await userEvent.click(within(row).getByRole('button', { name: 'Add key' }))
    expect(within(row).getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })
})
