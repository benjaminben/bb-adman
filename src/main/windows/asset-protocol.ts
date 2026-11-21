// The Electron side of adman-asset:// (SPEC 8.2; SPEC 14, Slice A rulings point 2). Only the
// Electron calls are here; every decision is in assets/asset-url.ts.
import type { Protocol } from 'electron'
import type { ProjectRegistry } from '@/main/db/project-registry'
import { answerAssetRequest } from '@/main/assets/asset-url'

const SCHEME = 'adman-asset'

// Before the app is ready. Every privilege but these three is off.
export function registerAssetScheme(protocol: Protocol): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        bypassCSP: false,
        allowServiceWorkers: false,
        supportFetchAPI: false,
        corsEnabled: false,
        codeCache: false,
        allowExtensions: false,
      },
    },
  ])
}

export function registerAssetProtocol(protocol: Protocol, projects: ProjectRegistry): void {
  protocol.handle(SCHEME, (request) => answerAssetRequest(request, projects))
}
