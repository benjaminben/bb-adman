// S2-5 (spec/screens-campaign.md, "Campaign page: ComfyUI failures in the run row"): the
// sentence by reason, the missing list, "Open Settings" and the server's own message.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { RunFailure } from '@/renderer/ui/run-failure'
import { fillMarks, plainMessage, reasonMessage } from '@/shared/providers/messages'
import {
  PROVIDER_ERROR_REASONS,
  type ProviderErrorReason,
  type ProviderInfo,
} from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { jobRow } from '../../stores/job-fixture'
import { REFUSED, heldReply } from './held-reply'
import { COMFY, INFO } from './video-fixture'

const P = '01JD00000000000000000000P1'
const SETTINGS_REASONS: ProviderErrorReason[] = [
  'address_needed',
  'no_answer',
  'not_comfyui',
  'sign_in_needed',
  'redirect_refused',
  'certificate',
  'address_refused',
]

function failed(over: Partial<JobRow> = {}): JobRow {
  return jobRow('J1', { status: 'failed', provider: 'comfyui', errorKind: 'other', ...over })
}

function comfyApi() {
  const fake = makeFakeApi()
  fake.onQuery('comfy.getInfo', () => ({ ok: true, data: INFO }))
  return fake
}

// `null` stands for a provider the window does not know.
function draw(row: JobRow, fake = comfyApi(), provider: ProviderInfo | null = COMFY) {
  return renderApp(
    <main>
      <RunFailure
        row={row}
        projectId={P}
        provider={provider ?? undefined}
        providerLabel="ComfyUI"
      />
    </main>,
    fake,
  )
}

const showButton = () => screen.getByRole('button', { name: "Show the server's message" })

describe('RunFailure: the sentence [FR-265, FR-266]', () => {
  it('shows the out_of_memory sentence', async () => {
    await draw(failed({ errorReason: 'out_of_memory' }))
    expect(screen.getByText(reasonMessage('out_of_memory'))).toBeInTheDocument()
  })

  it('reads "the saved address" before comfy.getInfo answers, then the address', async () => {
    const fake = makeFakeApi()
    const held = heldReply()
    fake.onQuery('comfy.getInfo', held.answer)
    await draw(failed({ errorKind: 'offline', errorReason: 'no_answer' }), fake)
    const before = fillMarks(reasonMessage('no_answer'), {})
    expect(screen.getByText(before)).toBeInTheDocument()
    expect(before).toContain('the saved address')
    held.release({ ok: true, data: INFO })
    const after = fillMarks(reasonMessage('no_answer'), { address: 'http://192.168.1.20:8188' })
    expect(await screen.findByText(after)).toBeInTheDocument()
  })

  it("gives the kind's sentence when the row has no reason", async () => {
    await draw(failed({ errorKind: 'timeout' }))
    expect(screen.getByText(plainMessage('timeout', 'ComfyUI'))).toBeInTheDocument()
  })

  it('lists each missing item, fills {n}, and drops a malformed entry', async () => {
    const missing = [
      { what: 'model', name: 'moss-v2.safetensors', folder: 'checkpoints' },
      { what: 'node', name: 'MossSampler' },
      { what: 'spaceship', name: 'x' },
      { what: 'model' },
      'not an item',
    ]
    await draw(failed({ errorReason: 'missing_items', result: { missing } }))
    expect(screen.getByText(fillMarks(reasonMessage('missing_items'), { n: 2 }))).toBeVisible()
    const list = screen.getByRole('list', { name: 'What the server is missing' })
    expect([...list.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Model moss-v2.safetensors, in the folder checkpoints',
      'Node MossSampler',
    ])
  })
})

describe('RunFailure: "Open Settings" [FR-265]', () => {
  it.each(PROVIDER_ERROR_REASONS.map((r) => [r, SETTINGS_REASONS.includes(r)] as const))(
    '%s offers Open Settings: %s',
    async (reason, offered) => {
      await draw(failed({ errorReason: reason }))
      const button = screen.queryByRole('button', { name: 'Open Settings' })
      expect(button !== null).toBe(offered)
    },
  )

  it('shows Settings when pressed', async () => {
    const { store } = await draw(failed({ errorReason: 'no_answer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Open Settings' }))
    expect(store.getState().view).toEqual({ kind: 'settings' })
  })
})

describe("RunFailure: the server's message [FR-267]", () => {
  it('sends job.getServerMessage once and draws the text; Hide asks nothing', async () => {
    const fake = comfyApi()
    fake.onQuery('job.getServerMessage', () => ({
      ok: true,
      data: { text: 'KSampler: CUDA out of memory' },
    }))
    await draw(failed({ errorReason: 'out_of_memory' }), fake)
    expect(showButton()).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(showButton())
    expect(await screen.findByText('KSampler: CUDA out of memory')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Message from the ComfyUI server' })).toBeVisible()
    const hide = screen.getByRole('button', { name: "Hide the server's message" })
    expect(hide).toHaveAttribute('aria-expanded', 'true')
    const block = document.getElementById(hide.getAttribute('aria-controls') ?? '')
    expect(block).toHaveTextContent('KSampler: CUDA out of memory')
    await userEvent.click(hide)
    expect(screen.queryByText('KSampler: CUDA out of memory')).toBeNull()
    await userEvent.click(showButton())
    expect(screen.getByText('KSampler: CUDA out of memory')).toBeInTheDocument()
    const asked = fake.queries.filter((q) => q.name === 'job.getServerMessage')
    expect(asked.map((q) => q.input)).toEqual([{ projectId: P, jobId: 'J1' }])
  })

  it('shows markup in the reply as characters, and the row holds no link', async () => {
    const fake = comfyApi()
    const text = '<a href="https://x.test">y</a>'
    fake.onQuery('job.getServerMessage', () => ({ ok: true, data: { text } }))
    const { container } = await draw(failed({ errorReason: 'run_failed' }), fake)
    await userEvent.click(showButton())
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(container.querySelector('a')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it.each([
    [
      'a null reply',
      { ok: true, data: { text: null } },
      'The server sent no message for this run.',
    ],
    ['a refused query', REFUSED, 'The run was refused.'],
  ] as const)('shows the sentence for %s', async (_name, reply, sentence) => {
    const fake = comfyApi()
    fake.onQuery('job.getServerMessage', () => reply)
    await draw(failed({ errorReason: 'run_failed' }), fake)
    await userEvent.click(showButton())
    expect(await screen.findByText(sentence)).toBeInTheDocument()
  })

  it('reads "Reading the server\'s message…" with the button disabled while it loads', async () => {
    const fake = comfyApi()
    const held = heldReply()
    fake.onQuery('job.getServerMessage', held.answer)
    await draw(failed({ errorReason: 'run_failed' }), fake)
    await userEvent.click(showButton())
    expect(screen.getByText("Reading the server's message…")).toBeInTheDocument()
    expect(showButton()).toBeDisabled()
    held.release({ ok: true, data: { text: 'done' } })
    await waitFor(() => expect(screen.getByText('done')).toBeInTheDocument())
  })

  it.each([
    ['without serverText', { ...COMFY, serverText: false }],
    ['unknown', null],
  ] as const)('has no button for a provider %s', async (_name, provider) => {
    await draw(failed({ errorReason: 'run_failed' }), comfyApi(), provider)
    expect(screen.queryByRole('button', { name: /server's message/ })).toBeNull()
  })

  it('has no axe violations with the list and the message open', async () => {
    const fake = comfyApi()
    fake.onQuery('job.getServerMessage', () => ({ ok: true, data: { text: 'Missing node' } }))
    const missing = [{ what: 'node', name: 'MossSampler' }]
    await draw(failed({ errorReason: 'missing_items', result: { missing } }), fake)
    await userEvent.click(showButton())
    await screen.findByText('Missing node')
    expect(await axeViolations()).toEqual([])
  })
})
