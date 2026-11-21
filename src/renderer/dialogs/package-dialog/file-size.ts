// A package's size for the done line: KB, MB or GB with one decimal place, 1 KB being 1024
// bytes (spec/screens-campaign.md, "Package project"). A value that rounds to 1024 of one unit
// is shown in the next one, so no line reads "1024.0 KB".
const UNITS = ['KB', 'MB', 'GB']

export function fileSize(bytes: number): string {
  let value = bytes / 1024
  let unit = 0
  while (unit < UNITS.length - 1 && Number(value.toFixed(1)) >= 1024) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${UNITS[unit]}`
}
