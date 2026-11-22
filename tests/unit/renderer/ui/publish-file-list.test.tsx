// P9-12 (spec/phases/phase-09.md "Screens"; R-06, A-218): the files a publish uploads, by
// folder, each with its display name and full local path drawn as plain text.
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { PublishFileList } from '@/renderer/ui/publish-file-list'
import { COMPONENTS, component, font } from '../dialogs/publish-fixture'
import { axeViolations } from '../render'

const list = () => screen.getByRole('region', { name: 'Files that will be uploaded' })
const folder = (name: string) => within(list()).getByRole('list', { name })

describe('the publish file list [P9-12, R-06, A-218]', () => {
  it('lists the files by folder, in the folder order, with name and full local path', async () => {
    render(<PublishFileList components={COMPONENTS} />)
    const names = within(list())
      .getAllByRole('list')
      .map((l) => l.getAttribute('aria-label'))
    expect(names).toEqual(['Logos', 'Backgrounds', 'Images'])
    const beach = within(folder('Backgrounds')).getByRole('listitem')
    expect(beach).toHaveTextContent('Beach at dawn')
    expect(beach).toHaveTextContent('/Users/ann/Pictures/Summer/beach-at-dawn.png')
    expect(within(folder('Logos')).getByRole('listitem')).toHaveTextContent(
      '/Users/ann/Brand/kettle-mark.png',
    )
    expect(await axeViolations()).toEqual([])
  })

  it('draws markup in a name or a path as text', () => {
    const odd = component({
      displayName: '<b>bold</b> <img src=x onerror=alert(1)>',
      localPath: '/Users/ann/<script>x</script>.png',
    })
    const { container } = render(<PublishFileList components={[odd]} />)
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(list()).toHaveTextContent('<b>bold</b> <img src=x onerror=alert(1)>')
    expect(list()).toHaveTextContent('/Users/ann/<script>x</script>.png')
  })

  it.each([
    ['missing', 'file not found, will be skipped'],
    ['wrong_type', 'not a usable file, will be skipped'],
  ] as const)('marks a file with the problem %s', (problem, line) => {
    render(<PublishFileList components={[component({ problem })]} />)
    expect(within(folder('Backgrounds')).getByRole('listitem')).toHaveTextContent(line)
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
    render(<PublishFileList components={fonts} />)
    const items = within(folder('Fonts')).getAllByRole('listitem')
    const text = (name: string) => items.find((i) => i.textContent?.includes(name))
    expect(text('Harbor Sans')).toHaveTextContent('will not be uploaded')
    expect(text('Lido Serif')).toHaveTextContent('will not be uploaded')
    expect(text('Quay Mono')).not.toHaveTextContent('will not be uploaded')
  })

  it('says so when there are no component files', () => {
    render(<PublishFileList components={[]} />)
    expect(list()).toHaveTextContent('No pictures, videos or fonts are used.')
  })
})
