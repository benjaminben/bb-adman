// The last step of `npm run package:mac:demo`: makes demo.zip at the repository root from the
// packaged app, .env.demo, and each folder or file listed in demo-extras.txt (one path per
// line; a line starting with # is a comment). demo.zip and demo-extras.txt are not in git.
// macOS only: it uses the system `zip`, which keeps the links inside the app.
import console from 'node:console'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const APP = path.join(ROOT, 'dist', 'mac-arm64', 'AdManager.app')
const ENV_FILE = path.join(ROOT, '.env.demo')
const EXTRAS_LIST = path.join(ROOT, 'demo-extras.txt')
const ZIP = path.join(ROOT, 'demo.zip')

function say(line) {
  process.stdout.write(`${line}\n`)
}

// The paths in demo-extras.txt, or none when the file is not there.
export function readExtras(listFile) {
  if (!fs.existsSync(listFile)) return []
  return fs
    .readFileSync(listFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
}

// Every item must exist, and no two may share a name: each sits at the top of the zip.
export function checkItems(items) {
  const names = new Set()
  for (const item of items) {
    if (!fs.existsSync(item)) throw new Error(`Not found: ${item}`)
    const name = path.basename(item)
    if (names.has(name)) throw new Error(`Two items are named "${name}". Rename one.`)
    names.add(name)
  }
}

// Adds one file or folder at the top of the zip. -y keeps links as links, -r takes folders.
function addItem(zipFile, item) {
  const folder = path.dirname(path.resolve(item))
  const name = path.basename(item)
  execFileSync('zip', ['-qry', zipFile, name, '-x', '*.DS_Store'], {
    cwd: folder,
    stdio: 'inherit',
  })
}

export function makeZip(zipFile, items) {
  checkItems(items)
  fs.rmSync(zipFile, { force: true })
  for (const item of items) {
    say(`  adding ${path.basename(item)}`)
    addItem(zipFile, item)
  }
}

function main() {
  if (process.platform !== 'darwin') throw new Error('package:mac:demo runs on macOS only.')
  const extras = readExtras(EXTRAS_LIST)
  if (extras.length === 0)
    say('No demo-extras.txt, or it is empty: the zip holds the app and .env.demo only.')
  say('Making demo.zip')
  makeZip(ZIP, [APP, ENV_FILE, ...extras])
  const megabytes = Math.round(fs.statSync(ZIP).size / 1024 / 1024)
  say(`demo.zip is ready (${megabytes} MB).`)
  say('It holds .env.demo, which has keys in it. Share it only with people who may have them.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(`package:mac:demo stopped: ${error.message}`)
    process.exit(1)
  }
}
