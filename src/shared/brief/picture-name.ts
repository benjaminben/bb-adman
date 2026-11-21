// spec/subject-photos.md "Shown names" [D-098]: the text a photo note shows for a picture a
// brief names. Only the part after the last `/` or `\`, cleaned as a bad brief line is, so a
// note never shows a folder or a mark that hides or reorders text. Pure; never throws.
import { cleanLineText } from './bad-line'

export function pictureName(text: string): string {
  const name = cleanLineText(
    text.slice(Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\')) + 1),
  )
  return name === '' ? '(no name)' : name
}
