// ED-5 (spec/phases/design-wave-screens-a.md): the editor top bar's Format is a group of two
// icon buttons, "Image" and "Video", with aria-pressed (no longer radios). The one place the
// end-to-end steps and shots find, choose and check it.
import { expect, type Page } from '@playwright/test'

export type FormatName = 'Image' | 'Video'

export const format = (page: Page) => page.getByRole('group', { name: 'Format', exact: true })

export const formatButton = (page: Page, name: FormatName) =>
  format(page).getByRole('button', { name, exact: true })

// The stored format is the pressed one.
export async function expectFormat(page: Page, name: FormatName): Promise<void> {
  await expect(formatButton(page, name)).toHaveAttribute('aria-pressed', 'true')
}

// One click on a segment; it sends variant.setFormat once when it is not the stored format.
export async function chooseFormat(page: Page, name: FormatName): Promise<void> {
  await formatButton(page, name).click()
}
