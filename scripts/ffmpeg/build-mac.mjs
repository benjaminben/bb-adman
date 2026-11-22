// Builds FFmpeg on this Mac from the checked source tree (P7-3, A-189): ./configure with
// exactly the JSON's flags, then make ffmpeg. Both run without a shell, with a fixed
// system PATH, so no tool from a user folder (Homebrew, conda) is picked up.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { run } from './run.mjs'

const MAKE = '/usr/bin/make'
const XCODE_SELECT = '/usr/bin/xcode-select'
const CC = '/usr/bin/cc'

/** @param {string} tmp a folder inside the work folder for the compiler's temporary files */
export function buildEnv(tmp) {
  return { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LC_ALL: 'C', TMPDIR: tmp }
}

/** Stops with the names of missing build tools. Installs nothing. */
export async function checkTools(runImpl = run) {
  const missing = [MAKE, CC].filter((tool) => !fs.existsSync(tool))
  const select = await runImpl(XCODE_SELECT, ['-p']).catch(() => ({ code: 1 }))
  if (select.code !== 0) missing.push('the Xcode Command Line Tools')
  if (missing.length > 0) {
    throw new Error(
      `Missing build tools: ${missing.join(', ')}. Install the Xcode Command Line Tools ` +
        '(xcode-select --install) yourself, then run this again.',
    )
  }
}

/**
 * @param {{ srcDir: string, tmp: string, configure: string[], runImpl?: typeof run }} options
 * @returns {Promise<string>} the path of the built binary
 */
export async function buildMac({ srcDir, tmp, configure, runImpl = run }) {
  await checkTools(runImpl)
  const env = buildEnv(tmp)
  const steps = [
    [path.join(srcDir, 'configure'), configure],
    [MAKE, [`-j${os.availableParallelism()}`, 'ffmpeg']],
  ]
  for (const [command, args] of steps) {
    const { code } = await runImpl(command, args, { cwd: srcDir, env, show: true })
    if (code !== 0) {
      throw new Error(`${path.basename(command)} ended with code ${code}; see ffbuild/config.log.`)
    }
  }
  return path.join(srcDir, 'ffmpeg')
}
