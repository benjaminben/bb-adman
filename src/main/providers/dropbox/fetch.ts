// The fetch every Dropbox call goes through (spec/phases/phase-09.md "Dropbox hosts and calls").
// core.ts puts it on CoreDeps; tests hand in one that keeps the pin and reaches the stand-in on
// 127.0.0.1 (tests/helpers/dropbox-stand-in.ts).
import { pinnedFetch } from './pinned-fetch'

export type DropboxFetch = typeof fetch

export const defaultDropboxFetch: DropboxFetch = pinnedFetch()
