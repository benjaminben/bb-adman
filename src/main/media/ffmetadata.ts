// The ffmetadata file FFmpeg reads the clip's details from (spec/phases/phase-07.md, "Clip
// facts, FFmpeg and the details"). The details go in a file, not on the command line, because of
// the Windows line limit; nothing in it is ever an FFmpeg option.

// FFmpeg's ffmetadata format: '=', ';', '#', '\' and line breaks are escaped with '\'.
const SPECIAL = /[=;#\\\n\r]/g

// P7-16: NUL ends a value inside FFmpeg, and no other control character belongs in the
// details, so a value holding one is refused, not written.
function isControl(c: string): boolean {
  const code = c.charCodeAt(0)
  if (c === '\n' || c === '\r') return false
  return code < 0x20 || (code >= 0x7f && code <= 0x9f)
}

export function escapeMetadata(value: string): string {
  if ([...value].some(isControl)) throw new Error('The value holds a control character')
  return value.replace(SPECIAL, (c) => `\\${c}`)
}

export function ffmetadataText(comment: string): string {
  return `;FFMETADATA1\ncomment=${escapeMetadata(comment)}\n`
}
