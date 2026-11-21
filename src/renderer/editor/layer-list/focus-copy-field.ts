// spec/editor.md, "Layer list": "Add text layer" puts the focus in the Copy field. That field
// belongs to the properties panel, so the list finds it in the editor by its label, "Copy".
// Gives true when it found and focused the field.
export function focusCopyField(editor: HTMLElement | null | undefined): boolean {
  if (!editor) return false
  const field = Array.from(editor.querySelectorAll('textarea')).find(
    (area) =>
      area.getAttribute('aria-label') === 'Copy' ||
      Array.from(area.labels ?? []).some((label) => label.textContent?.trim() === 'Copy'),
  )
  field?.focus()
  return field !== undefined
}
