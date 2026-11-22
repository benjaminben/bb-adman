// The swatch field's popover (spec/app-style-parts.md, "Swatch field"): "Hex colour" and the
// system colour picker, placed by ui/menu-place at elevation 2. A valid #rrggbb on Enter, or
// the picker's change (the choice made, not each move), is passed up once in lower case; any
// other text shows one line under the field and passes nothing. Escape closes it and the field
// puts the focus back on "+"; a press outside closes it and leaves the focus where it went.
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { menuPlaceStyles, useMenuPlace } from '@/renderer/ui/menu-place'
import { HEX_COLOUR } from '@/shared/schemas/layer'
import styles from './swatch-field.module.css'

const BAD_HEX = 'Use a colour like #1A2B3C.'

type Props = {
  id: string
  value: string | null
  trigger: RefObject<HTMLButtonElement | null>
  onCommit: (hex: string) => void
  onClose: (focusBack: boolean) => void
}

export function SwatchPopover(props: Props) {
  const box = useRef<HTMLDivElement>(null)
  const hexField = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const place = useMenuPlace(true, props.trigger, box)
  const [text, setText] = useState(props.value?.toLowerCase() ?? '')
  const [bad, setBad] = useState(false)
  const errorId = `${props.id}-error`

  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })

  useEffect(() => {
    hexField.current?.focus()
    const input = picker.current
    const onPick = () => input && latest.current.onCommit(input.value.toLowerCase())
    const onPress = (event: PointerEvent) => {
      const target = event.target as Node
      if (box.current?.contains(target) || latest.current.trigger.current?.contains(target)) return
      latest.current.onClose(false)
    }
    input?.addEventListener('change', onPick)
    document.addEventListener('pointerdown', onPress)
    return () => {
      input?.removeEventListener('change', onPick)
      document.removeEventListener('pointerdown', onPress)
    }
  }, [])

  function save() {
    const hex = text.trim()
    if (HEX_COLOUR.test(hex)) props.onCommit(hex.toLowerCase())
    else setBad(true)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      props.onClose(true)
    }
    if (event.key === 'Enter' && event.target === hexField.current) {
      event.preventDefault()
      save()
    }
  }

  const start = props.value && HEX_COLOUR.test(props.value) ? props.value.toLowerCase() : '#000000'

  return (
    <div
      ref={box}
      id={props.id}
      className={`${menuPlaceStyles.placed} ${styles.popover}`}
      onKeyDown={onKeyDown}
      {...place}
    >
      <div className={styles.popRow}>
        <input
          ref={hexField}
          className={styles.hex}
          aria-label="Hex colour"
          aria-invalid={bad}
          aria-describedby={bad ? errorId : undefined}
          spellCheck={false}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setBad(false)
          }}
        />
        <input
          ref={picker}
          type="color"
          className={styles.picker}
          aria-label="Colour picker"
          defaultValue={start}
        />
      </div>
      {bad && (
        <p id={errorId} className={styles.error}>
          {BAD_HEX}
        </p>
      )}
    </div>
  )
}
