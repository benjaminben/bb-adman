// The check table (CAMP-4): a head row of the six checks (each head's title the check's full
// name), then one row group per checked post in grid order. Which rows are open is held by the
// panel, so the "{n} warnings" mark can open the first warned row.
import layout from '@/renderer/ui/layout.module.css'
import { CHECKS, checkHead, checkName } from './check-words'
import { PostRows, type Post } from './post-rows'
import styles from './check-panel.module.css'

export function CheckTable(props: {
  projectId: string
  posts: Post[]
  open: Set<string>
  onToggle: (variantId: string) => void
}) {
  return (
    <table className={layout.table}>
      <thead>
        <tr>
          <th scope="col">
            <span className={styles.hidden}>Post</span>
          </th>
          {CHECKS.map((id) => (
            <th key={id} scope="col" className={styles.colHead} title={checkName(id)}>
              {checkHead(id)}
            </th>
          ))}
        </tr>
      </thead>
      {props.posts.map((post) => {
        const id = post.variant.id
        return (
          <PostRows
            key={id}
            projectId={props.projectId}
            post={post}
            open={props.open.has(id)}
            onToggle={() => props.onToggle(id)}
          />
        )
      })}
    </table>
  )
}
