// P9-12 (spec/phases/phase-09.md "Screens"; R-06), DLG-6b: the files a publish uploads, in
// the folder order, each with its display name and kind drawn as plain text and no path.
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { PublishFileList } from '@/renderer/ui/publish-file-list'
import { COMPONENTS, component, font } from '../dialogs/publish-fixture'
import { axeViolations } from '../render'

const list = () => screen.getByRole('region', { name: 'Files that will be uploaded' })
const files = () => within(list()).getByRole('list', { name: 'Files' })

describe('the publish file list [P9-12, R-06, A-218]', () => {
  it('lists the files in the folder order, with name and kind and no path', async () => {
    render(<PublishFileList projectId="p1" components={COMPONENTS} />)
    const items = within(files()).getAllByRole('listitem')
    expect(items.map((i) => i.querySelector('bdi')?.textContent)).toEqual([
      'Kettle Co. mark',
      'Beach at dawn',
      'Old hero',
    ])
    expect(items[1]).toHaveTextContent('Picture')
    for (const c of COMPONENTS) expect(list().outerHTML).not.toContain(c.localPath)
    expect(await axeViolations()).toEqual([])
  })

  it('draws markup in a name as text, and no path', () => {
    const odd = component({
      displayName: '<b>bold</b> <img src=x onerror=alert(1)>',
      localPath: '/Users/ann/<script>x</script>.png',
    })
    const { container } = render(<PublishFileList projectId="p1" components={[odd]} />)
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(list()).toHaveTextContent('<b>bold</b> <img src=x onerror=alert(1)>')
    expect(list()).not.toHaveTextContent('/Users/ann/')
  })

  it.each([
    ['missing', 'File not found', 'File not found, will be skipped'],
    ['wrong_type', 'Not usable', 'Not a usable file, will be skipped'],
  ] as const)('marks a file with the problem %s', (problem, mark, line) => {
    render(<PublishFileList projectId="p1" components={[component({ problem })]} />)
    const item = within(files()).getByRole('listitem')
    expect(within(item).getByText(mark)).toBeVisible()
    expect(item).toHaveTextContent(line)
  })

  it('marks a font without consent on this computer as not uploaded, and a confirmed one not', () => {
    const fonts = [
      font({ share: 'needs_confirming' }),
      font({
        assetId: '01JD0000000000000000000010',
        displayName: 'Lido Serif',
        share: 'not_shared',
      }),
      font({ assetId: '01JD0000000000000000000011', displayName: 'Quay Mono', share: 'confirmed' }),
    ]
    render(<PublishFileList projectId="p1" components={fonts} />)
    const items = within(files()).getAllByRole('listitem')
    const text = (name: string) => items.find((i) => i.textContent?.includes(name))
    expect(text('Harbor Sans')).toHaveTextContent('Not uploaded')
    expect(text('Lido Serif')).toHaveTextContent('Not uploaded')
    expect(text('Quay Mono')).not.toHaveTextContent('Not uploaded')
  })

  it('says so when there are no component files', () => {
    render(<PublishFileList projectId="p1" components={[]} />)
    expect(list()).toHaveTextContent('No pictures, videos or fonts are used.')
  })
})

describe('names that try to disguise themselves [P9-12 review]', () => {
  it('strips an override and a line break, so a fake "will not be uploaded" tail stays inside the name', () => {
    const odd = font({
      displayName: 'Quay‮​\nwill not be uploaded',
      localPath: '/Users/ann/‮fonts/quay.ttf',
      share: 'confirmed',
    })
    const { container } = render(<PublishFileList projectId="p1" components={[odd]} />)
    const item = within(files()).getByRole('listitem')
    const names = container.querySelectorAll('bdi')
    expect(names).toHaveLength(1)
    expect(names[0]?.textContent).toBe('Quaywill not be uploaded')
    expect(item.textContent).not.toMatch(/[\u{202E}\u{200B}\n]/u)
    expect(item).not.toHaveTextContent('quay.ttf')
    expect(item.textContent?.match(/will not be uploaded/g)).toHaveLength(1)
  })

  it('cuts a 5,000-character name at 200 code points and shows no path', () => {
    const path = `/Users/ann/${'deep/'.repeat(400)}x.png`
    render(
      <PublishFileList
        projectId="p1"
        components={[component({ displayName: 'N'.repeat(5000), localPath: path })]}
      />,
    )
    const item = within(files()).getByRole('listitem')
    expect(item.querySelector('bdi')?.textContent).toBe(`${'N'.repeat(200)}…`)
    expect(item.outerHTML).not.toContain('deep/')
  })
})
