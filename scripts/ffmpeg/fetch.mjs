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
const PLATFORMS = ['win32-x64', 'darwin-arm64', 'darwin-x64']

function say(line) {
  process.stdout.write(`${line}\n`)
}

// Windows has no getuid, so there this check lets every account through.
export function refuseRoot(getuid = process.getuid) {
  if (getuid?.() === 0) throw new Error('Do not run this as root or with sudo.')
}

// A real folder, never a link that could send the writes somewhere else.
export function realFolder(folder) {
  fs.mkdirSync(folder, { recursive: true })
  if (!fs.lstatSync(folder).isDirectory()) throw new Error(`${folder} is not a plain folder.`)
}

// Deletes .work only when it is a real folder, never what a link points at.
function removeWork(work) {
  const stat = fs.lstatSync(work, { throwIfNoEntry: false })
  if (!stat) return
  if (!stat.isDirectory()) throw new Error(`${work} is not a plain folder.`)
  fs.rmSync(work, { recursive: true })
}

/** Makes an empty {ffmpegDir}/.work and returns its path. */
export function freshWork(ffmpegDir) {
  realFolder(path.dirname(ffmpegDir))
  realFolder(ffmpegDir)
  const work = path.join(ffmpegDir, '.work')
  removeWork(work)
  fs.mkdirSync(work)
  return work
}

async function windowsBinary(sources, work) {
  const { url, sha256, member } = sources.windows
  const archive = await download({ url, sha256, dest: path.join(work, 'ffmpeg.zip') })
  say('Downloaded and checked the Windows build.')
  const top = member.split('/')[0]
  await unpack({ archive, sha256, into: work, top, members: [member] })
  return path.join(work, member)
}

async function macBinary(sources, work) {
  const { url, sha256, configure } = sources.source
  const archive = await download({ url, sha256, dest: path.join(work, 'source.tar.xz') })
  say('Downloaded and checked the FFmpeg source.')
  const top = `ffmpeg-${sources.version}`
  await unpack({ archive, sha256, into: work, top })
  const tmp = path.join(work, 'tmp')
  fs.mkdirSync(tmp)
  return buildMac({ srcDir: path.join(work, top), tmp, configure })
}

/** Copies a checked binary to the ship path, {ffmpegDir}/{key}/ffmpeg[.exe], mode 755. */
export function install(built, ffmpegDir, key) {
  if (!fs.lstatSync(built).isFile()) throw new Error('The built FFmpeg is not a plain file.')
  const folder = path.join(ffmpegDir, key)
  realFolder(folder)
  const dest = path.join(folder, key.startsWith('win32') ? 'ffmpeg.exe' : 'ffmpeg')
  fs.rmSync(dest, { force: true })
  fs.copyFileSync(built, dest, fs.constants.COPYFILE_EXCL)
  fs.chmodSync(dest, 0o755)
  return dest
}

/**
 * Gets the binary into .work, runs the licence check on it there, and only then copies it
 * to the ship path. .work is removed however the run ends.
 * @param {{ ffmpegDir: string, key: string, getBinary: (work: string) => Promise<string>,
 *   check?: typeof licenceCheck }} options
 */
export async function fetchFfmpeg({ ffmpegDir, key, getBinary, check = licenceCheck }) {
  const work = freshWork(ffmpegDir)
  try {
    const built = await getBinary(work)
    const verdict = await check(built)
    if (!verdict.ok) throw new Error(`The licence check failed: ${verdict.reason}. Deleted.`)
    return install(built, ffmpegDir, key)
  } finally {
    removeWork(work)
  }
}

async function main() {
  refuseRoot()
  const key = `${process.platform}-${process.arch}`
  if (!PLATFORMS.includes(key)) throw new Error(`No FFmpeg source for ${key}.`)
  const sources = readSources()
  const fromSource = key.startsWith('win32') ? windowsBinary : macBinary
  const getBinary = (work) => fromSource(sources, work)
  const dest = await fetchFfmpeg({ ffmpegDir: FFMPEG_DIR, key, getBinary })
  say(`Licence check passed. FFmpeg ${sources.version} is at ${path.relative(ROOT, dest)}.`)
  say(`Size: ${fs.statSync(dest).size} bytes.`)
}

// Runs only as `node scripts/ffmpeg/fetch.mjs`, never when a test imports this file.
function isEntryPoint() {
  const started = process.argv[1]
  if (!started) return false
  try {
    return fs.realpathSync(started) === fs.realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isEntryPoint()) {
  main().catch((error) => {
    console.error(`fetch:ffmpeg stopped: ${error.message}`)
    process.exitCode = 1
  })
}
