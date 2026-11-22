// P6-18 (spec/phases/phase-06.md, "Paid calls"): a translation job is one per direction and
// language, so "Translate {language} again…" counts one paid request per direction-and-language
// pair it will run. The paid line may overstate, never understate. One pair keeps the singular
// wording; more use the paid line's own wording and plural rule.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { runSummary } from '@/renderer/dialogs/run-dialog/run-summary'
import { TranslationPanel } from '@/renderer/screens/campaign/translation-panel'
import { requestCount } from '@/renderer/screens/campaign/translation-panel/translation-words'
import type { TranslationRow } from '@/shared/schemas/queries/translation'
import { baseState, makeFakeApi } from '../../fake-api'
import { renderApp } from '../../render'
import { costLine } from '../../cost-line'
import { MASTER, P, campaignGet } from './campaign-fixture'
import { translationRow as row, translations } from './translation-fixture'

const GEMINI = baseState().providers[0]!

describe('requestCount [P6-18]', () => {
  it.each<[string, TranslationRow[], number]>([
    ['one direction, one language', [row('L1'), row('L2', { variantId: 'V9' })], 1],
    ['one language over two directions', [row('L1'), row('L2', { directionId: 'D2' })], 2],
    [
      'two languages over two directions',
      [
        row('L1'),
        row('L2', { directionId: 'D2' }),
        row('L3', { language: 'fr' }),
        row('L4', { language: 'fr', directionId: 'D2' }),
        row('L5', { language: 'fr', directionId: 'D2', variantId: 'V8' }),
      ],
      4,
    ],
  ])('%s', (_, rows, n) => {
    expect(requestCount(rows)).toBe(n)
  })
})

describe('runSummary for a paid text run with several requests [P6-18]', () => {
  it.each<[number | undefined, string]>([
    [undefined, 'Paid: 1 request → Google Gemini'],
    [1, 'Paid: 1 request → Google Gemini'],
    [2, 'Paid: 2 requests → Google Gemini'],
    [4, 'Paid: 4 requests → Google Gemini'],
  ])('%s request(s)', (requests, line) => {
    expect(runSummary({ job: 'text', provider: GEMINI, requests })).toBe(line)
  })
})

async function openAgain(rows: TranslationRow[]) {
  const fake = makeFakeApi(baseState())
  fake.onQuery('translation.forCampaign', () => ({ ok: true, data: translations(rows) }))
  await renderApp(
    <TranslationPanel projectId={P} campaignId="C1" data={campaignGet([MASTER])} />,
    fake,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Translate German again…' }))
  return within(await screen.findByRole('dialog', { name: 'Translate' }))
}

describe('Translate {language} again… counts its requests [P6-18]', () => {
  it('a language spanning two directions shows 2 paid requests', async () => {
    const dialog = await openAgain([row('L1'), row('L2', { directionId: 'D2', variantId: 'V7' })])
    expect(dialog.getByText(costLine('Paid: 2 requests → Google Gemini'))).toBeVisible()
  })

  it('one direction and one language keeps the singular wording', async () => {
    const dialog = await openAgain([row('L1'), row('L2', { variantId: 'V7' })])
    expect(dialog.getByText(costLine('Paid: 1 request → Google Gemini'))).toBeVisible()
  })
})
