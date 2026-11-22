// The ffmetadata file FFmpeg reads the clip's details from (spec/phases/phase-07.md, "Clip
// facts, FFmpeg and the details"). The details go in a file, not on the command line, because of
// the Windows line limit; nothing in it is ever an FFmpeg option.

// FFmpeg's ffmetadata format: '=', ';', '#', '\' and line breaks are escaped with '\'.
const SPECIAL = /[=;#\\\n\r]/g

export function escapeMetadata(value: string): string {
  return value.replace(SPECIAL, (c) => `\\${c}`)
}

export function ffmetadataText(comment: string): string {
  return `;FFMETADATA1\ncomment=${escapeMetadata(comment)}\n`
}
