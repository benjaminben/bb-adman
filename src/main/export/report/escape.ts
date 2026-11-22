// The one place report text becomes HTML text (spec/phases/phase-08.md "Report", HTML [A-203]).
// Every value on the page passes through escapeHtml, in element text and in attributes alike.
// The page builders never put a value into markup any other way.
const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char)
}

// An element with escaped text inside. `tag` and `className` are fixed words of the page,
// never values.
export function element(tag: string, text: string, className?: string): string {
  const attribute = className ? ` class="${className}"` : ''
  return `<${tag}${attribute}>${escapeHtml(text)}</${tag}>`
}
