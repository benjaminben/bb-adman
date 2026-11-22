// The fetch every Dropbox call goes through (spec/phases/phase-09.md "Dropbox hosts and calls").
// core.ts puts it on CoreDeps; tests hand in one that reaches the stand-in on 127.0.0.1.
// Stub (P9-1): refuses every call before a socket opens, until P9-2 makes it the pinned fetch.
export type DropboxFetch = typeof fetch

export const defaultDropboxFetch: DropboxFetch = () =>
  Promise.reject(new Error('The Dropbox client is not built yet.'))
