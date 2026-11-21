// LK-7: three of the stakeholder's reference looks (02, 03 and 04) rebuilt through the editor's
// screens, at 1080 × 1920, with the fake providers and pictures drawn by the test. Set-up (the
// project and campaign) uses commands; every look change goes through the picture chooser, the
// panel fields, "Layout…" and canvas drags. Pictures: the editor (shot) and the ad alone for
// each look, plus the shade (03) and the outlined button (04) close up.
import { test, expect } from '@playwright/test'
import path from 'node:path'
import { closeApp, openApp, shot, type Session } from './shot'
import { drawBadge, drawForest, drawProduct, drawRoom } from './lk-7-pictures'
import {
  adPicture,
  applyLayout,
  campaignAndOpen,
  addPicture,
  choosePicture,
  clearSelection,
  moveSelected,
  panel,
  resizeCorner,
  select,
  selectedBox,
  setBox,
  setNumber,
} from './lk-7-steps'

let session: Session | undefined

const LOGO = { x: 64, y: 64, width: 160, height: 160 }

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

test('02: a light flat colour, a dark centred headline, a picture off the right and bottom', async () => {
  session = await openApp()
  const { app, page, box } = session
  const product = path.join(box.root, 'phone-and-card.png')
  const badge = path.join(box.root, 'dark-badge.png')
  await drawProduct(app, product)
  await drawBadge(app, badge, [20, 20, 24])
  await campaignAndOpen(page, {
    name: 'Flat colour',
    message: 'Keep your morning loaf fresh for days.',
    callToAction: 'Order ahead in the app',
  })

  await applyLayout(page, 'Flat colour, headline above the subject')
  await select(page, 'Background')
  const picture = panel(page).getByRole('group', { name: 'Picture' })
  const remove = picture.getByRole('button', { name: 'Remove picture' })
  if (await remove.isEnabled()) await remove.click()
  await expect(picture.getByText('Empty picture')).toBeVisible()
  await expect(
    picture.getByRole('textbox', { name: 'Background colour', exact: true }),
  ).toHaveValue('#F2F2F5')

  await addPicture(app, page, badge, { x: 465, y: 120, width: 150, height: 150 })
  await addPicture(app, page, product, { x: 240, y: 860, width: 700, height: 900 })
  await resizeCorner(page, 140, 180)
  await moveSelected(page, 200, 150)
  await expect
    .poll(async () => {
      const placed = await selectedBox(page)
      return placed.x + placed.width > 1080 && placed.y + placed.height > 1920
    })
    .toBe(true)

  await clearSelection(page)
  await page.waitForTimeout(500)
  await shot(page, '120-lk7-02-flat-colour-editor')
  await adPicture(page, '121-lk7-02-flat-colour-ad')
})

test('03: a photo with a dark shade from the bottom and white text at the bottom left', async () => {
  session = await openApp()
  const { app, page, box } = session
  const room = path.join(box.root, 'dim-room.png')
  const badge = path.join(box.root, 'blue-badge.png')
  await drawRoom(app, room)
  await drawBadge(app, badge, [40, 110, 200])
  await campaignAndOpen(page, {
    name: 'Photo and shade',
    message: 'Stay ahead of the morning rush',
    callToAction: 'Coffee ready when you are',
  })

  await select(page, 'Background')
  await choosePicture(app, page, room)
  const shade = panel(page).getByRole('group', { name: 'Shade' })
  await expect(shade.getByRole('combobox', { name: 'Shade' })).toHaveValue('bottom')
  await setNumber(shade, 'Strength', 90)
  await setNumber(shade, 'Reach', 55)

  await addPicture(app, page, badge, LOGO)
  await select(page, 'Call to action')
  const boxFields = panel(page).getByRole('group', { name: 'Box' })
  const outline = boxFields.getByRole('group', { name: 'Outline colour' })
  await outline.getByRole('button', { name: 'None' }).click()
  await expect(outline.getByRole('button', { name: 'None' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await setNumber(boxFields, 'Padding', 0)
  const text = panel(page).getByRole('group', { name: 'Text settings' })
  await text.getByRole('group', { name: 'Align' }).getByRole('button', { name: 'Left' }).click()
  await text.getByRole('combobox', { name: 'Weight' }).selectOption('400')
  await setNumber(text, 'Size', 46)
  await setBox(page, { x: 65, y: 1625, width: 950, height: 80 })

  await clearSelection(page)
  await page.waitForTimeout(500)
  await shot(page, '122-lk7-03-photo-shade-editor')
  await adPicture(page, '123-lk7-03-photo-shade-ad')
  await adPicture(page, '124-lk7-03-shade-close', { x: 0, y: 1000, width: 1080, height: 920 })
})

test('04: a photo, white text at the bottom left and an outlined button', async () => {
  session = await openApp()
  const { app, page, box } = session
  const forest = path.join(box.root, 'forest-from-below.png')
  const badge = path.join(box.root, 'green-badge.png')
  await drawForest(app, forest)
  await drawBadge(app, badge, [40, 150, 60])
  await campaignAndOpen(page, {
    name: 'Photo and button',
    message: 'Fresh every morning',
    callToAction: 'Shop now',
  })

  await select(page, 'Background')
  await choosePicture(app, page, forest)
  const shade = panel(page).getByRole('group', { name: 'Shade' })
  await setNumber(shade, 'Strength', 45)

  await addPicture(app, page, badge, LOGO)
  await select(page, 'Call to action')
  const boxFields = panel(page).getByRole('group', { name: 'Box' })
  await setNumber(boxFields, 'Outline width', 4)
  await setNumber(boxFields, 'Corner radius', 6)
  const button = await selectedBox(page)

  await clearSelection(page)
  await page.waitForTimeout(500)
  await shot(page, '125-lk7-04-photo-button-editor')
  await adPicture(page, '126-lk7-04-photo-button-ad')
  const pad = 60
  await adPicture(page, '127-lk7-04-button-close', {
    x: Math.max(0, button.x - pad),
    y: Math.max(0, button.y - pad),
    width: button.width + pad * 2,
    height: Math.min(1920 - (button.y - pad), button.height + pad * 2),
  })
})
