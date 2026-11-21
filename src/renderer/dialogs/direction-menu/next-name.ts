// spec/screens-variants.md, "Direction dialogs": the default name of a new direction,
// "Direction {n}" with the next free number. It starts one above the count of directions and
// skips a number already taken; names compare trimmed and ignoring letter case, as
// direction.createFromMaster compares them (A-139).
export function nextDirectionName(names: readonly string[]): string {
  const taken = new Set(names.map((name) => name.trim().toLowerCase()))
  let n = names.length + 1
  while (taken.has(`direction ${n}`)) n += 1
  return `Direction ${n}`
}
