// R3-2: the in-app report names the model of a generated picture, like the HTML file.
import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportAd } from '@/renderer/dialogs/report-view/report-ad'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { Report } from '@/shared/schemas/report'
import { sampleReport } from '../../../fixtures/report-sample'
import { renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'

const GEMINI: ProviderInfo = {
  ...baseState().providers[0]!,
  defaultModels: { image: 'gemini-nano-banana-2.1' },
  modelLabels: { image: 'Nano Banana 2.1' },
}
const WORKFLOW = {
  job: 'image',
  offered: true,
  model: { label: 'MOSS-Image', mainFile: 'moss.st' },
}

async function draw(models: string[]) {
  const [first] = sampleReport.variants
  const assets = first!.assets.map((a, i) => (models[i] ? { ...a, model: models[i] } : a))
  const report: Report = { ...sampleReport, variants: [{ ...first!, assets }] }
  const fake = makeFakeApi(baseState({ providers: [GEMINI] }))
  fake.onQuery('comfy.getInfo', () => ({
    ok: true,
    data: { address: null, workflows: [WORKFLOW], leavesOnServer: [] },
  }))
  await renderApp(<ReportAd report={report} ad={report.variants[0]!} />, fake)
  await act(async () => {})
}

describe('report view names the model [R3-2]', () => {
  it('names a registry model', async () => {
    await draw(['gemini-nano-banana-2.1'])
    expect(screen.getByText('Nano Banana 2.1')).toBeVisible()
  })

  it('names a ComfyUI workflow’s model by its main file', async () => {
    await draw(['moss.st'])
    expect(screen.getByText('MOSS-Image')).toBeVisible()
  })

  it('shows the ID of a model it does not know', async () => {
    await draw(['fake-image-1'])
    expect(screen.getByText('fake-image-1')).toBeVisible()
  })
})
