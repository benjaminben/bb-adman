// S2-10: the drop layer over the project home while files are dragged in, and the import
// dialog a drop opens. The pictures are small made-up PNGs written into the sandbox.
import { test, expect } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import * as screens from '../e2e/screens'
import { dragFiles, writePng } from '../e2e/drop-files'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

const PICTURES: Record<string, [number, number, number]> = {
  'citrus-can-front.png': [240, 180, 40],
  'citrus-can-side.png': [230, 150, 30],
  'picnic-table.png': [120, 90, 60],
}

test('the drop layer and the import dialog a drop opens', async () => {
  session = await openApp()
  const { page, box } = session
  const folder = path.join(box.root, 'Shoot')
  fs.mkdirSync(folder)
  const files = Object.entries(PICTURES).map(([name, rgb]) => {
    const file = path.join(folder, name)
    writePng(file, rgb)
    return file
  })
  await screens.createProject(page, 'Summer Launch')

  await dragFiles(page, files, ['dragenter', 'dragover'])
  await expect(page.getByText('Drop to import into Summer Launch')).toBeVisible()
  await shot(page, '25-project-home-drop-layer')

  await dragFiles(page, files, ['drop'])
  const dialog = page.getByRole('dialog', { name: 'Import 3 file(s)' })
  await expect(dialog.getByRole('radio').first()).toBeFocused()
  await shot(page, '26-import-dialog-dropped')
})
