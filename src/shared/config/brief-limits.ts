// SPEC 6.1 "Reading a brief file safely" [1.23]: the one owner of the brief size limit.
// parseBrief compares it with the text's length; slice C's brief.parse with the file's size.
export const MAX_BRIEF_BYTES = 1_048_576
