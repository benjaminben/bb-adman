// The renderer's only reader of window.drop (spec/screens-campaign.md "Importing by dropping
// files"). Gives the full paths of dropped files in order, leaving out empty answers.
export function droppedPaths(files: FileList): string[] {
  const drop = window.drop
  if (!drop) return []
  const paths: string[] = []
  for (const file of Array.from(files)) {
    const found = drop.pathOf(file)
    if (found) paths.push(found)
  }
  return paths
}
