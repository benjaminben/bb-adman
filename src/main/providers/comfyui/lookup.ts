// SPEC 6.10.2 (security class): the resolved address is checked. Every ComfyUI request
// passes this as its `lookup`. It resolves the name, refuses when any address is on the
// refused list of 6.10.1 with the app's own ports as they are now, and hands the socket only
// the addresses it checked.
import dns, { type LookupAddress } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { isRefusedHost } from '@/shared/comfy/refused-hosts'

export class AddressRefused extends Error {
  constructor() {
    super('The address the name resolves to is refused')
    this.name = 'AddressRefused'
  }
}

export type Resolve = (
  host: string,
  callback: (err: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void

const resolveAll: Resolve = (host, callback) => dns.lookup(host, { all: true }, callback)

export function checkedLookup(
  port: number,
  ownPorts: () => readonly number[],
  resolve: Resolve = resolveAll,
): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, (err, found) => {
      if (err) return callback(err, '')
      const family = options.family === 4 || options.family === 6 ? options.family : 0
      const list = family ? found.filter((a) => a.family === family) : found
      const ports = ownPorts()
      const first = list[0]
      if (!first || list.some((a) => isRefusedHost(a.address, port, ports))) {
        return callback(new AddressRefused(), '')
      }
      if (options.all) return callback(null, list)
      callback(null, first.address, first.family)
    })
  }
}
