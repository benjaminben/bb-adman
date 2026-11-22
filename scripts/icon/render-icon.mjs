// D10: draws src/renderer/ui/app-mark/app-mark.svg into resources/icon.png (1024 x 1024) in a
// hidden offscreen window. Run with `npx electron scripts/icon/render-icon.mjs`; the PNG is
// committed, so a build never needs this.
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'

const SIZE = 1024
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const source = path.join(root, 'src/renderer/ui/app-mark/app-mark.svg')
const target = path.join(root, 'resources/icon.png')

function page(svg) {
  const picture = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  const style = 'margin:0;overflow:hidden;background:transparent'
  return `<!doctype html><body style="${style}"><img src="${picture}" width="${SIZE}" height="${SIZE}" style="display:block"></body>`
}

async function render() {
  app.dock?.hide()
  const window = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true, javascript: false },
  })
  const html = page(fs.readFileSync(source, 'utf8'))
  await window.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
  await setTimeout(500)
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE })
  const sized = image.getSize().width === SIZE ? image : image.resize({ width: SIZE, height: SIZE })
  fs.writeFileSync(target, sized.toPNG())
  window.destroy()
}

app
  .whenReady()
  .then(render)
  .then(
    () => app.quit(),
    (error) => {
      process.stderr.write(`${error}\n`)
      app.exit(1)
    },
  )
