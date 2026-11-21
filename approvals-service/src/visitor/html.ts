// spec/approvals-service.md "Escaping": the one way page text is built. Every value put into
// the template is escaped; only the template's own results are kept as they are.

export class Html {
  readonly text: string
  constructor(text: string) {
    this.text = text
  }
}

export type HtmlValue = string | number | Html | readonly HtmlValue[]

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeText(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? '')
}

function render(value: HtmlValue): string {
  if (value instanceof Html) return value.text
  if (Array.isArray(value)) {
    let out = ''
    for (const item of value as readonly HtmlValue[]) out += render(item)
    return out
  }
  return escapeText(String(value))
}

export function html(strings: TemplateStringsArray, ...values: HtmlValue[]): Html {
  let out = strings[0] ?? ''
  values.forEach((value, i) => {
    out += render(value) + (strings[i + 1] ?? '')
  })
  return new Html(out)
}

// The frame of every page: one stylesheet, no script.
export function documentOf(title: string, body: Html): Html {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>${title}</title>
        <link rel="stylesheet" href="/gallery.css" />
      </head>
      <body>
        <main>${body}</main>
      </body>
    </html> `
}
