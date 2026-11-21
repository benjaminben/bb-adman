// SPEC 6.1 "Reading a brief file safely" [1.23, 1.26 item 7]: the one owner of the brief
// limits. MAX_BRIEF_BYTES is 64 KiB counted in UTF-8 bytes: parseBrief counts the text's
// bytes, slice C's brief.parse reads the file's size.
export const MAX_BRIEF_BYTES = 65_536
