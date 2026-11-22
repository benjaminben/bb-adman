// spec/editor.md, "Properties panel", "Text": the nine weights. ED-2 shows them by name only.
export const WEIGHTS: Array<[number, string]> = [
  [100, 'Thin'],
  [200, 'Extra light'],
  [300, 'Light'],
  [400, 'Regular'],
  [500, 'Medium'],
  [600, 'Semibold'],
  [700, 'Bold'],
  [800, 'Extra bold'],
  [900, 'Black'],
]

export const weightName = (weight: number): string =>
  WEIGHTS.find(([w]) => w === weight)?.[1] ?? String(weight)
