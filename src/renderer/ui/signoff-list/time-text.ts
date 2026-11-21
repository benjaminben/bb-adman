// A stored ISO time as the user's local date and time, for the sign-off list, the approval bar
// and the approval dialog.
export function timeText(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// The date alone, for "This link was turned off on {date}."
export function dateText(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}
