// SPEC 14 step 0 R1, 8.1: the openExternal handed to createCore opens https: addresses only.
function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function httpsOnly(open: (url: string) => Promise<void>): (url: string) => Promise<void> {
  return async (url) => {
    if (!isHttps(url)) throw new Error('openExternal opens https: addresses only')
    await open(url)
  }
}
