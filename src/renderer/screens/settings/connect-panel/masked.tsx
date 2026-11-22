// The agent access token drawn masked (SET-5, OI-DW-4): until "Show", every place the token sits
// in a text is drawn as dots that a screen reader skips, followed by the hidden word "hidden".
// The token itself is then in no text node and no attribute. Shown, the text is drawn as is.
import { Fragment } from 'react'
import styles from './connect-panel.module.css'

export const DOTS = '••••••••••••'

export function Masked(props: { text: string; token: string; shown: boolean }) {
  if (props.shown || props.token === '') return <>{props.text}</>
  const parts = props.text.split(props.token)
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              <span aria-hidden="true">{DOTS}</span>
              <span className={styles.hidden}>hidden</span>
            </>
          )}
          {part}
        </Fragment>
      ))}
    </>
  )
}
