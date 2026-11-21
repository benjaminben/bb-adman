// A picture run that stays running, for the close and quit warnings (P4-10). The fake provider's
// waitMs cannot be set in the built app, so this holds a Gemini run instead: `fetch` in the
// main process is replaced, as gemini-stand-in.ts does, by one that never answers a request
// off this computer and gives up only when the app aborts it. No request leaves the computer
// and no call is paid. The key is a made-up one. Not a test file itself.
import type { ElectronApplication, Page } from '@playwright/test'
import { command, query } from './render-helpers'
import { MADE_UP_KEY } from './gemini-stand-in'

type Held = { __e2eHeldAsked?: string[] }

export async function holdGemini(app: ElectronApplication): Promise<void> {
  await app.evaluate(() => {
    const held = globalThis as unknown as Held
    const asked: string[] = []
    held.__e2eHeldAsked = asked
    const inner = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const address = typeof input === 'string' ? input : 'url' in input ? input.url : input.href
      const url = new URL(address)
      if (url.hostname === '127.0.0.1') return inner(input, init)
      asked.push(url.origin)
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('held run aborted')))
      })
    }
  })
}

// The origins the held fetch was asked for, oldest first.
export async function heldAsked(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(() => [...((globalThis as unknown as Held).__e2eHeldAsked ?? [])])
}

type Ids = { projectId: string; campaignId: string; variantId: string; filePath: string }

// The shown project's first campaign and variant, and the project file.
export async function firstIds(page: Page): Promise<Ids> {
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string; filePath: string }[]
  }
  const { projectId, filePath } = state.openProjects[0]!
  const project = (await query(page, 'project.get', { projectId })) as {
    campaigns: { id: string }[]
  }
  const campaignId = project.campaigns[0]!.id
  const campaign = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string }[]
  }
  return { projectId, campaignId, variantId: campaign.variants[0]!.id, filePath }
}

// Starts one held Gemini picture run for the first picture slot; gives its job ID.
export async function startHeldRun(page: Page, ids: Ids): Promise<string> {
  await command(page, 'secret.set', { name: 'gemini.apiKey', value: MADE_UP_KEY })
  const slots = (await query(page, 'template.slots', {
    projectId: ids.projectId,
    campaignId: ids.campaignId,
  })) as { slot: { id: string; type: string } }[]
  const slot = slots.find((s) => s.slot.type === 'image') ?? slots[0]!
  const { jobId } = (await command(page, 'generation.runImages', {
    projectId: ids.projectId,
    variantId: ids.variantId,
    slot: slot.slot.id,
    prompt: 'A held run for the quit warning',
    referenceAssetIds: [],
    count: 1,
    provider: 'gemini',
  })) as { jobId: string }
  return jobId
}

export async function jobStatus(page: Page, projectId: string, jobId: string): Promise<string> {
  const rows = (await query(page, 'job.list', { projectId })) as { id: string; status: string }[]
  return rows.find((r) => r.id === jobId)?.status ?? 'missing'
}
