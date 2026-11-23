// A two-item list of text and any number is a link (spec/comfyui-custom.md "The file
// checks"). The file checks, the reference slots and fill.ts all use this one test.
export const isLink = (v: unknown): v is [string, number] =>
  Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'number'
