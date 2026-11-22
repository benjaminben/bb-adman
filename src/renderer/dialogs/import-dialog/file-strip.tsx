// DLG-3b (spec/phases/design-wave-screens-b.md): the files to import as a strip of up to six
// small tiles, each named in its `title` and hidden text, then a "+{m}" chip for the rest. The
// files are not in the project yet and the window may load pictures only through the asset
// address (ui/asset-url.ts), so a tile draws an icon (picture, file or folder), never a picture
// read from a path. Only base names reach the page.
import { Icon, type IconName } from '@/renderer/ui/icon'
import { plural } from '@/renderer/ui/plural'
import { shownNames } from './import-text'
import styles from './import-dialog.module.css'

const PICTURE = /\.(png|jpe?g|webp|gif)$/i

function tileIcon(name: string, folder: boolean): IconName {
  if (folder) return 'folder'
  return PICTURE.test(name) ? 'image' : 'file'
}

export function FileStrip(props: { paths: string[]; folder: boolean }) {
  const { names, more } = shownNames(props.paths)
  return (
    <div className={styles.strip}>
      <ul className={styles.tiles} aria-label="Files to import">
        {names.map((name, i) => (
          <li key={i} className={styles.tile} title={name}>
            <Icon name={tileIcon(name, props.folder)} />
            <span className={styles.hidden}>{name}</span>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <span className={styles.more} title={`${plural(more, 'more file')}`}>
          <span aria-hidden="true">+{more}</span>
          <span className={styles.hidden}>{plural(more, 'more file')}</span>
        </span>
      )}
    </div>
  )
}
