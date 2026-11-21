// window.drop, the drop bridge (spec/security.md "The drop bridge", S2-3). It turns a File
// the operating system handed the page into that file's full path, and '' for anything else.
// It takes no path and reads no file.
export type DropApi = {
  pathOf(file: File): string
}
