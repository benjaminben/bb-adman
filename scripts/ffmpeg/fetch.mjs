// npm run fetch:ffmpeg (P7-3, OI-09): puts a licence-checked LGPL FFmpeg at
// resources/ffmpeg/{platform}-{arch}/ffmpeg[.exe]. Windows x64 takes the pinned builder
// release; macOS builds the pinned source here. Run by hand only, never at install time.
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'
import { buildMac } from './build-mac.mjs'
import { download } from './download.mjs'
import { licenceCheck } from './licence-check.mjs'
import { readSources } from './sources.mjs'
import { unpack } from './unpack.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const FFMPEG_DIR = path.join(ROOT, 'resources', 'ffmpeg')
const WORK = path.join(FFMPEG_DIR, '.work')
const PLATFORMS = ['win32-x64', 'darwin-arm64', 'darwin-x64']

function say(line) {
  process.stdout.write(`${line}\n`)
}

// A real folder, never a link that could send the writes somewhere else.
function realFolder(folder) {
  fs.mkdirSync(folder, { recursive: true })
  if (!fs.lstatSync(folder).isDirectory()) throw new Error(`${folder} is not a plain folder.`)
}

function freshWork() {
  realFolder(path.join(ROOT, 'resources'))
  realFolder(FFMPEG_DIR)
  if (fs.existsSync(WORK)) {
    if (!fs.lstatSync(WORK).isDirectory()) throw new Error(`${WORK} is not a plain folder.`)
    fs.rmSync(WORK, { recursive: true })
  }
  fs.mkdirSync(WORK)
}

async function windowsBinary(sources) {
  const { url, sha256, member } = sources.windows
  const archive = await download({ url, sha256, dest: path.join(WORK, 'ffmpeg.zip') })
  say('Downloaded and checked the Windows build.')
  const top = member.split('/')[0]
  await unpack({ archive, sha256, into: WORK, top, members: [member] })
  return path.join(WORK, member)
}

async function macBinary(sources) {
  const { url, sha256, configure } = sources.source
  const archive = await download({ url, sha256, dest: path.join(WORK, 'source.tar.xz') })
  say('Downloaded and checked the FFmpeg source.')
  const top = `ffmpeg-${sources.version}`
  await unpack({ archive, sha256, into: WORK, top })
  const tmp = path.join(WORK, 'tmp')
  fs.mkdirSync(tmp)
  return buildMac({ srcDir: path.join(WORK, top), tmp, configure })
}

function install(built, key) {
  if (!fs.lstatSync(built).isFile()) throw new Error('The built FFmpeg is not a plain file.')
  const folder = path.join(FFMPEG_DIR, key)
  realFolder(folder)
  const dest = path.join(folder, key.startsWith('win32') ? 'ffmpeg.exe' : 'ffmpeg')
  fs.rmSync(dest, { force: true })
  fs.copyFileSync(built, dest, fs.constants.COPYFILE_EXCL)
  fs.chmodSync(dest, 0o755)
  return dest
}

async function main() {
  if (process.getuid?.() === 0) throw new Error('Do not run this as root or with sudo.')
  const key = `${process.platform}-${process.arch}`
  if (!PLATFORMS.includes(key)) throw new Error(`No FFmpeg source for ${key}.`)
  const sources = readSources()
  freshWork()
  const built = key.startsWith('win32') ? await windowsBinary(sources) : await macBinary(sources)
  const dest = install(built, key)
  const verdict = await licenceCheck(dest)
  if (!verdict.ok) throw new Error(`The licence check failed: ${verdict.reason}. Deleted.`)
  fs.rmSync(WORK, { recursive: true })
  say(`Licence check passed. FFmpeg ${sources.version} is at ${path.relative(ROOT, dest)}.`)
  say(`Size: ${fs.statSync(dest).size} bytes.`)
}

main().catch((error) => {
  console.error(`fetch:ffmpeg stopped: ${error.message}`)
  process.exitCode = 1
})
