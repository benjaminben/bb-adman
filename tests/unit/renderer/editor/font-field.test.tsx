// spec/editor.md, "Fonts: upload and choice" [REQ: FR-056, FR-093]: a "Font" select of the default
// font and the asset library's fonts, labelled by fontFamily (else the display name); "Upload
// font…" picks one font file, imports it linked into the asset library, then sets it.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FontField } from '@/renderer/editor/font-field'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { P, assetRow } from './editor-fixture'

const font = (id: string, fontFamily: string | null, missing = false) =>
  assetRow(id, {
    kind: 'font',
    mime: 'font/woff2',
    displayName: `${id}.woff2`,
    fontFamily,
    missing,
  })

const FONTS = [font('F1', 'Fraunces'), font('F2', null), font('F3', 'Bebas Neue', true)]

async function setup(options: { fontAssetId?: string | null; disabled?: boolean } = {}) {
  const fake = makeFakeApi()
  const log: string[] = []
  fake.onQuery('asset.list', () => ({ ok: true, data: FONTS }))
  const onChange = vi.fn(async (id: string | null) => {
    log.push(`update ${id}`)
    return null
  })
  await renderApp(
    <main>
      <FontField
        projectId={P}
        fontAssetId={options.fontAssetId ?? null}
        disabled={options.disabled ?? false}
        onChange={onChange}
      />
    </main>,
    fake,
  )
  const select = screen.getByRole('combobox', { name: 'Font' })
  await within(select).findByRole('option', { name: 'Fraunces' })
  return { fake, log, onChange, select }
}

const optionNames = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((o) => o.textContent)

describe('FontField [spec/editor.md "Fonts: upload and choice"]', () => {
  it('lists the default font, then the asset library fonts by fontFamily or display name', async () => {
    const { fake, select } = await setup()
    expect(fake.queries.filter((q) => q.name === 'asset.list').map((q) => q.input)).toEqual([
      { projectId: P, library: 'asset', kind: 'font' },
    ])
    expect(optionNames(select)).toEqual([
      'Default font (Inter)',
      'Fraunces',
      'F2.woff2',
      'Bebas Neue (file not found)',
    ])
    expect(select).toHaveValue('')
  })

  it.each([
    ['Fraunces', 'F1'],
    ['Default font (Inter)', null],
  ])('choosing %s sends that font', async (name, id) => {
    const { onChange, select } = await setup({ fontAssetId: id === null ? 'F2' : null })
    await userEvent.selectOptions(select, name)
    expect(onChange.mock.calls).toEqual([[id]])
  })

  it('upload sends the font picker, then the import, then the update with the new font', async () => {
    const { fake, log } = await setup()
    fake.onQuery('dialog.pickFiles', (input) => {
      log.push(`pick ${JSON.stringify(input)}`)
      return { ok: true, data: { paths: ['/fonts/Grotesk.otf'] } }
    })
    fake.onCommand('asset.import', (input) => {
      log.push(`import ${JSON.stringify(input)}`)
      return { ok: true, data: { assetIds: ['F9'] } }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Upload font…' }))
    await vi.waitFor(() => expect(log).toHaveLength(3))
    expect(log).toEqual([
      `pick ${JSON.stringify({ purpose: 'import', kind: 'font', multiple: false })}`,
      `import ${JSON.stringify({ projectId: P, paths: ['/fonts/Grotesk.otf'], library: 'asset', copy: false })}`,
      'update F9',
    ])
  })

  it('a cancelled picker sends nothing', async () => {
    const { fake, onChange } = await setup()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: [] } }))
    await userEvent.click(screen.getByRole('button', { name: 'Upload font…' }))
    await vi.waitFor(() =>
      expect(fake.queries.some((q) => q.name === 'dialog.pickFiles')).toBe(true),
    )
    expect(fake.commands).toEqual([])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('a refused import shows its message and changes nothing', async () => {
    const { fake, onChange } = await setup()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/fonts/bad.ttf'] } }))
    fake.onCommand('asset.import', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'That file is not a font Adman can use.' },
    }))
    await userEvent.click(screen.getByRole('button', { name: 'Upload font…' }))
    expect(await screen.findByText('That file is not a font Adman can use.')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('a locked layer disables the select and the upload', async () => {
    const { select } = await setup({ disabled: true })
    expect(select).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Upload font…' })).toBeDisabled()
  })

  it('has no accessibility violations', async () => {
    await setup({ fontAssetId: 'F1' })
    expect(await axeViolations()).toEqual([])
  })
})
