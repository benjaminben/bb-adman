// node scripts/ffmpeg/make-fixtures.mjs (P7-3): makes the two test clips with the fetched
// FFmpeg, once, on a Mac. The only place the binary is run with -f lavfi.
import console from 'node:console'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { URL, fileURLToPath } from 'node:url'
import { run } from './run.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const BINARY = path.join(ROOT, 'resources', 'ffmpeg', `darwin-${process.arch}`, 'ffmpeg')
const OUT = path.join(ROOT, 'tests', 'fixtures', 'video')
const MAX_BYTES = 50 * 1024

const picture = ['-f', 'lavfi', '-i', 'color=c=0x3366cc:s=64x64:r=24:d=1']
const sound = ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono']
const video = ['-c:v', 'h264_videotoolbox', '-b:v', '100k']
const clips = [
  ['tiny.mp4', [...picture, ...video, '-an']],
  ['tiny-sound.mp4', [...picture, ...sound, ...video, '-c:a', 'aac_at', '-b:a', '32k', '-t', '1']],
]

async function main() {
  if (process.platform !== 'darwin') throw new Error('The test clips are made on a Mac.')
  if (!fs.lstatSync(BINARY, { throwIfNoEntry: false })?.isFile()) {
    throw new Error('No FFmpeg here yet. Run npm run fetch:ffmpeg first.')
  }
  fs.mkdirSync(OUT, { recursive: true })
  for (const [name, args] of clips) {
    const file = path.join(OUT, name)
    // -n: never write over a clip already there.
    const all = ['-hide_banner', '-n', ...args, '-movflags', '+faststart', `file:${file}`]
    const { code } = await run(BINARY, all, { cwd: OUT, show: true })
    if (code !== 0) throw new Error(`FFmpeg ended with code ${code} making ${name}.`)
    const size = fs.statSync(file).size
    if (size > MAX_BYTES) {
      fs.rmSync(file)
      throw new Error(`${name} came out at ${size} bytes, over the 50 KB limit. Deleted.`)
    }
    process.stdout.write(`${name}: ${size} bytes\n`)
  }
}

main().catch((error) => {
  console.error(`make-fixtures stopped: ${error.message}`)
  process.exitCode = 1
})
