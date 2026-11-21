// SPEC 6.1 "Reading a brief file safely" [1.23, 1.31 item 9, 1.39]: the one owner of the brief
// limits. A brief has no size limit [1.39 Z7]. MAX_BRIEF_DEPTH is the deepest nesting a YAML
// brief may have, checked on the library's tokens before compose. MAX_BAD_LINE_CHARS [1.39 Z3]
// is the longest first bad line, in code points, a malformed YAML brief's error shows.
export const MAX_BRIEF_DEPTH = 32
export const MAX_BAD_LINE_CHARS = 120
