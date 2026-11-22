// Real plurals in place of "(s)" (DLG-1): "1 file", "2 files", "0 files". English only. The
// number is printed as given; pass `many` where adding "s" is wrong ("copy", "copies").
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
