// SPEC 6.1 "Reading a brief file safely" [1.23, 1.26 item 7, 1.31 item 9]: the one owner of
// the brief limits. MAX_BRIEF_BYTES is 64 KiB counted in UTF-8 bytes: parseBrief counts the
// text's bytes, slice C's brief.parse reads the file's size. MAX_BRIEF_DEPTH is the deepest
// nesting a YAML brief may have, checked on the library's tokens before compose.
export const MAX_BRIEF_BYTES = 65_536
export const MAX_BRIEF_DEPTH = 32
