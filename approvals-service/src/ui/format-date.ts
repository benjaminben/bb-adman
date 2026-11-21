// spec/approvals-gallery.md "Components": `YYYY-MM-DD HH:MM UTC` from milliseconds.
export function formatDate(ms: number): string {
  const iso = new Date(ms).toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}
