// Reads and checks scripts/ffmpeg-sources.json (P7-3, OI-09). Nothing in it is trusted:
// every value is checked here before the fetch script uses it.
import fs from 'node:fs'
import { URL } from 'node:url'

export const SOURCES_FILE = new URL('../ffmpeg-sources.json', import.meta.url)

// The builder's release host and its download hosts, and the FFmpeg project's host.
export const LISTED_HOSTS = Object.freeze([
  'github.com',
  'release-assets.githubusercontent.com',
  'ffmpeg.org',
])

const WINDOWS_PREFIX = '/FFmpeg-Builds/FFmpeg-Builds/releases/download/'
const SOURCE_PREFIX = '/releases/'
const HASH = /^[0-9a-f]{64}$/
const VERSION = /^\d+\.\d+(\.\d+)?$/
// One path segment: starts with a letter, digit or underscore, so it never reads as an
// option, and holds no glob character, since tar reads a member name as a pattern.
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/
// Only --enable-x or --disable-x, with an optional list of plain names. No program, no path.
const FLAG = /^--(enable|disable)-[a-z0-9-]+(=[a-z0-9_,]+)?$/

function fail(message) {
  throw new Error(`ffmpeg-sources.json: ${message}`)
}

/**
 * An https: address on one of `hosts`, with no user name, password or port.
 * @param {string} value
 * @param {readonly string[]} hosts
 */
export function checkUrl(value, hosts) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('Not an address.')
  }
  if (url.protocol !== 'https:') throw new Error('Only https: addresses are allowed.')
  if (!hosts.includes(url.hostname)) throw new Error(`The host ${url.hostname} is not listed.`)
  if (url.username || url.password || url.port) {
    throw new Error('An address may not carry a user name, password or port.')
  }
  return url
}

function checkPinned(part, name, prefix) {
  if (typeof part?.url !== 'string') fail(`${name}.url is missing.`)
  const url = checkUrl(part.url, LISTED_HOSTS)
  if (!url.pathname.startsWith(prefix) || url.search || url.hash) {
    fail(`${name}.url is not a pinned release address.`)
  }
  if (typeof part.sha256 !== 'string' || !HASH.test(part.sha256)) {
    fail(`${name}.sha256 must be 64 lower-case hex digits.`)
  }
  return url
}

function checkMember(member) {
  if (typeof member !== 'string' || !member.split('/').every((s) => SEGMENT.test(s))) {
    fail('windows.member must be a plain relative path.')
  }
  if (member.split('/').includes('..')) fail('windows.member may not hold "..".')
}

function checkConfigure(flags) {
  if (!Array.isArray(flags) || flags.length === 0) fail('source.configure must be a list.')
  for (const flag of flags) {
    if (typeof flag !== 'string' || !FLAG.test(flag)) fail(`The configure flag ${flag} is refused.`)
  }
  if (flags.includes('--enable-gpl') || flags.includes('--enable-nonfree')) {
    fail('GPL and non-free parts are not allowed.')
  }
  if (!flags.includes('--disable-gpl') || !flags.includes('--disable-nonfree')) {
    fail('source.configure must hold --disable-gpl and --disable-nonfree.')
  }
}

/** @param {unknown} value the parsed JSON */
export function checkSources(value) {
  if (typeof value !== 'object' || value === null) fail('must be an object.')
  const { version, windows, source } = value
  if (typeof version !== 'string' || !VERSION.test(version)) fail('version is not a version.')
  if (typeof windows !== 'object' || windows === null) fail('windows is missing.')
  if (typeof source !== 'object' || source === null) fail('source is missing.')
  checkPinned(windows, 'windows', WINDOWS_PREFIX)
  checkMember(windows.member)
  const sourceUrl = checkPinned(source, 'source', SOURCE_PREFIX)
  if (sourceUrl.pathname !== `${SOURCE_PREFIX}ffmpeg-${version}.tar.xz`) {
    fail(`source.url is not the ffmpeg-${version}.tar.xz archive.`)
  }
  checkConfigure(source.configure)
  return value
}

export function readSources() {
  return checkSources(JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8')))
}
