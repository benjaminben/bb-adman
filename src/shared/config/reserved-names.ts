// SPEC 4.2 notes, 14 H14 [1.17]: the one owner of the device names Windows reserves, in any
// letter case. Windows looks at the part before the first dot, with spaces dropped from its
// end. Project names and storage paths both use it. [1.20] B-01: COM0, LPT0, the superscript
// digits 1 to 3, CONIN$ and CONOUT$ too.
export const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$)$/i
export const isReserved = (n: string) => WINDOWS_RESERVED.test((n.split('.')[0] ?? '').trimEnd())
