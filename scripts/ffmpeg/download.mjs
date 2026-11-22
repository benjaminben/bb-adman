// Downloads one pinned archive (P7-3): https: only, listed hosts only, every redirect
// checked before it is followed, at most 300 MB, SHA-256 checked before the caller gets it.
import crypto from 'node:crypto'
import fs from 'node:fs'
import { URL } from 'node:url'
import { checkUrl, LISTED_HOSTS } from './sources.mjs'

export const MAX_BYTES = 300 * 1024 * 1024
const MAX_REDIRECTS = 5

/** @param {string} file */
export async function hashFile(file) {
  const hash = crypto.createHash('sha256')
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

// Follows redirects by hand so each new address is checked before any request is sent.
async function answerFor(url, fetchImpl) {
  let current = checkUrl(url, LISTED_HOSTS)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchImpl(current.href, { redirect: 'manual' })
    if (response.status < 300 || response.status >= 400) {
      if (response.status !== 200)
        throw new Error(`${current.hostname} answered ${response.status}.`)
      return response
    }
    const location = response.headers.get('location')
    if (!location) throw new Error(`${current.hostname} sent a redirect with no address.`)
    current = checkUrl(new URL(location, current).href, LISTED_HOSTS)
  }
  throw new Error('Too many redirects.')
}

async function writeLimited(response, out, hash, maxBytes) {
  const stated = Number(response.headers.get('content-length'))
  if (stated > maxBytes) throw new Error('The download is over the size limit.')
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > maxBytes) throw new Error('The download is over the size limit.')
    hash.update(chunk)
    await out.write(chunk)
  }
}

/**
 * @param {{ url: string, sha256: string, dest: string,
 *   fetchImpl?: typeof fetch, maxBytes?: number }} options
 * @returns {Promise<string>} `dest`, holding bytes whose SHA-256 is `sha256`
 */
export async function download({
  url,
  sha256,
  dest,
  fetchImpl = globalThis.fetch,
  maxBytes = MAX_BYTES,
}) {
  const response = await answerFor(url, fetchImpl)
  // `wx`: never write over or through anything already at `dest`.
  const out = await fs.promises.open(dest, 'wx')
  const hash = crypto.createHash('sha256')
  try {
    await writeLimited(response, out, hash, maxBytes)
    await out.close()
  } catch (error) {
    await out.close()
    fs.rmSync(dest, { force: true })
    throw error
  }
  const actual = hash.digest('hex')
  if (actual !== sha256) {
    fs.rmSync(dest, { force: true })
    throw new Error(`The SHA-256 of ${new URL(url).pathname} does not match the pinned one.`)
  }
  return dest
}
