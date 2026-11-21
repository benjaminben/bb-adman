// The report page's inline style (spec/phases/phase-08.md "Report", HTML). The one place it
// lives. It holds no url(), no @import and no font file: the page loads nothing. Values sit in
// isolated runs (unicode-bidi), so a direction mark in a title or prompt turns only that value
// around, never the labels beside it.
export const REPORT_CSS = `
:root { color-scheme: light; }
body {
  margin: 0 auto; max-width: 960px; padding: 24px 16px;
  font: 14px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif;
  color: #1d1d1f; background: #ffffff;
}
h1 { font-size: 24px; margin: 0 0 16px; }
h2 { font-size: 18px; margin: 32px 0 8px; border-bottom: 1px solid #d2d2d7; padding-bottom: 4px; }
h3 { font-size: 16px; margin: 0 0 8px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
dt { color: #6e6e73; }
dd { margin: 0; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; vertical-align: top; padding: 4px 8px; border-bottom: 1px solid #e5e5ea; }
th { color: #6e6e73; font-weight: normal; }
ul { margin: 0; padding-left: 20px; }
.value { unicode-bidi: isolate; overflow-wrap: anywhere; white-space: pre-wrap; }
.note { color: #6e6e73; }
.warn { color: #9a5b00; }
.failure { color: #b00020; }
.ad { display: grid; grid-template-columns: 240px 1fr; gap: 16px; margin-top: 24px;
  padding-top: 16px; border-top: 1px solid #d2d2d7; }
.ad img { max-width: 240px; max-height: 240px; }
.ad .picture { color: #6e6e73; }
@media (max-width: 600px) { .ad { grid-template-columns: 1fr; } }
`
