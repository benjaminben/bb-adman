// R3-2: the report's details for a generated picture name the model that made it, falling
// back to the stored ID when the app does not know the name.
import { describe, it, expect } from 'vitest'
import { reportHtml } from '@/main/export/report/html'
import type { Report } from '@/shared/schemas/report'
import { samplePictures, sampleReport } from '../../../../fixtures/report-sample'

function pageWithModel(model: string): string {
  const [first, ...rest] = sampleReport.variants
  const assets = first!.assets.map((a, i) => (i === 0 ? { ...a, provider: 'gemini', model } : a))
  const report: Report = { ...sampleReport, variants: [{ ...first!, assets }, ...rest] }
  return reportHtml(report, samplePictures)
}

const modelField = (name: string) => new RegExp(`Model</dt><dd><span[^>]*>${name}</span></dd>`)

describe('report details name the model [R3-2]', () => {
  it('names a registry model', () => {
    expect(pageWithModel('gemini-nano-banana-2.1')).toMatch(modelField('Nano Banana 2.1'))
  })

  it('names a ComfyUI workflow’s model by its main file', () => {
    expect(pageWithModel('moss_image_sft_int8_convrot.safetensors')).toMatch(
      modelField('MOSS-Image'),
    )
  })

  it('shows the ID itself for a model it does not know', () => {
    expect(pageWithModel('fake-image-1')).toMatch(modelField('fake-image-1'))
  })
})
