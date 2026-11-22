// Unpacks a downloaded archive with the system tar (P7-3). The SHA-256 is checked again
// here, before tar sees the file, and the member list is checked before anything is
// written: plain files and folders under one top folder, no "..", no absolute path, no link.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { hashFile } from './download.mjs'
import { run } from './run.mjs'

export const TAR = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : '/usr/bin/tar'

const KINDS = new Set(['-', 'd'])

function lines(text) {
  return text.split('\n').filter((line) => line !== '')
}

/**
 * @param {string[]} names from `tar -tf`
 * @param {string[]} types first character of each `tar -tvf` line
 * @param {string} top the one folder every member sits in
 */
export function checkMembers(names, types, top) {
  if (names.length === 0) throw new Error('The archive is empty.')
  if (names.length !== types.length) throw new Error('The archive listing does not add up.')
  names.forEach((name, i) => {
    const segments = name.replace(/\/$/, '').split('/')
    if (name.startsWith('/') || name.includes('\\') || /^[A-Za-z]:/.test(name)) {
      throw new Error(`The archive member ${name} is not a relative path.`)
    }
    if (segments.includes('..')) throw new Error(`The archive member ${name} climbs out.`)
    if (segments[0] !== top) throw new Error(`The archive member ${name} is outside ${top}.`)
    if (!KINDS.has(types[i])) throw new Error(`The archive member ${name} is a link or device.`)
  })
}

async function tar(args, runImpl) {
  const { code, stdout } = await runImpl(TAR, args)
  if (code !== 0) throw new Error(`tar ${args[0]} ended with code ${code}.`)
  return stdout
}

/**
 * @param {{ archive: string, sha256: string, into: string, top: string,
 *   members?: string[], runImpl?: typeof run }} options
 *   `members` limits extraction to those names; without it the whole archive is unpacked.
 */
export async function unpack({ archive, sha256, into, top, members, runImpl = run }) {
  if ((await hashFile(archive)) !== sha256) {
    throw new Error('The SHA-256 of the archive does not match the pinned one.')
  }
  const names = lines(await tar(['-tf', archive], runImpl))
  const types = lines(await tar(['-tvf', archive], runImpl)).map((line) => line[0])
  checkMembers(names, types, top)
  for (const member of members ?? []) {
    if (!names.includes(member)) throw new Error(`${member} is not in the archive.`)
  }
  await tar(['-x', '-f', archive, '-C', into, ...(members ?? [])], runImpl)
  for (const member of members ?? []) {
    const stat = fs.lstatSync(path.join(into, member))
    if (!stat.isFile()) throw new Error(`${member} did not unpack as a plain file.`)
  }
}
