// The one stylesheet, served at /gallery.css (spec/approvals-service.md "Visitor pages").
// A fixed text: nothing from outside goes into it.

export const STYLES = `
:root { color-scheme: light dark; --muted: #6b6b6b; --line: #d0d0d0; --box: #e4e4e4; }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px; font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 1200px; margin: 0 auto; }
h1 { margin: 0 0 8px; font-size: 28px; }
h2 { margin: 0; font-size: 18px; }
h3 { margin: 12px 0 4px; font-size: 14px; }
form { margin: 0; }
input { font: inherit; padding: 6px 8px; border: 1px solid var(--line); border-radius: 4px; }
button { font: inherit; padding: 6px 12px; cursor: pointer; }
.intro { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
.notice { padding: 8px 12px; border: 1px solid var(--line); border-radius: 4px; }
.failure { color: #b00020; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  padding: 0;
  list-style: none;
}
.card { border: 1px solid var(--line); border-radius: 6px; padding: 12px; }
.card img { display: block; width: 100%; height: auto; }
.expired { background: var(--box); color: var(--muted); padding: 24px 12px; font-size: 14px; }
.size { color: var(--muted); font-size: 14px; margin: 0; }
.signoffs { list-style: none; margin: 0; padding: 0; font-size: 14px; }
.signoffs li { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
.earlier { color: var(--muted); }
.sign { display: flex; gap: 8px; margin-top: 12px; }
.sign input { flex: 1; min-width: 0; }
`
