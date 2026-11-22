// The licence check of phase-07.md, "Where FFmpeg comes from": `-L` names the GNU Lesser
// General Public License and `-buildconf` holds neither --enable-gpl nor --enable-nonfree.
// A binary that fails is deleted.
import fs from 'node:fs'
import { run } from './run.mjs'

const LGPL = /GNU Lesser General Public License/
const GPL = /GNU General Public License/
const NONFREE = /nonfree/i
const BAD_FLAG = /(^|\s)--enable-(gpl|nonfree)(\s|$)/

/**
 * @param {string} licenceText what `ffmpeg -hide_banner -L` printed
 * @param {string} buildconfText what `ffmpeg -hide_banner -buildconf` printed
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function judgeLicence(licenceText, buildconfText) {
  const licence = licenceText.replace(/\s+/g, ' ')
  if (!LGPL.test(licence)) return { ok: false, reason: 'it does not name the LGPL' }
  if (GPL.test(licence)) return { ok: false, reason: 'it names the GPL' }
  if (NONFREE.test(licence)) return { ok: false, reason: 'it has non-free parts' }
  if (!/configuration:/.test(buildconfText)) {
    return { ok: false, reason: 'it printed no build configuration' }
  }
  if (BAD_FLAG.test(buildconfText)) {
    return { ok: false, reason: 'it was built with --enable-gpl or --enable-nonfree' }
  }
  return { ok: true }
}

async function ask(binary, flag, runImpl) {
  const { code, stdout } = await runImpl(binary, ['-hide_banner', flag])
  if (code !== 0) throw new Error(`ffmpeg ${flag} ended with code ${code}`)
  return stdout
}

/**
 * Runs the binary twice and deletes it unless it passes.
 * @param {string} binary absolute path
 * @param {typeof run} [runImpl]
 */
export async function licenceCheck(binary, runImpl = run) {
  let verdict
  try {
    const licenceText = await ask(binary, '-L', runImpl)
    const buildconfText = await ask(binary, '-buildconf', runImpl)
    verdict = judgeLicence(licenceText, buildconfText)
  } catch (error) {
    verdict = { ok: false, reason: `it could not be run (${error.message})` }
  }
  if (!verdict.ok) fs.rmSync(binary, { force: true })
  return verdict
}
