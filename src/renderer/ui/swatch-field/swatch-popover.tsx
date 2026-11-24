// The swatch field's popover (spec/app-style-parts.md, "Swatch field", D-109): the app's own
// colour picker, placed by ui/menu-place at elevation 2. The square and the hue slider change
// the draft only; the draft is saved on release or Enter there, and the popover stays open.
// Enter in "Hex colour" saves a valid #rrggbb in upper case and closes; any other text shows
// one line and saves nothing. Escape closes it and the field puts the focus back on the
// button that opened it; a press outside closes it and saves nothing.
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { menuPlaceStyles, useMenuPlace } from '@/renderer/ui/menu-place'
import { HEX_COLOUR } from '@/shared/schemas/layer'
import { hexToHsb, hsbToHex, type Hsb } from './colour-maths'
import { ColourSquare } from './colour-square'
import { HueSlider } from './hue-slider'
import picker from './colour-picker.module.css'
import styles from './swatch-field.module.css'

const BAD_HEX = 'Use a colour like #1A2B3C.'

type Props = {
  id: string
  value: string | null
  anchor: RefObject<HTMLElement | null>
  openers: RefObject<HTMLButtonElement | null>[]
  onSave: (hex: string) => void
  onClose: (focusBack: boolean) => void
}

export function SwatchPopover(props: Props) {
  const box = useRef<HTMLDivElement>(null)
  const hexField = useRef<HTMLInputElement>(null)
  const place = useMenuPlace(true, props.anchor, box)
  const start = props.value && HEX_COLOUR.test(props.value) ? props.value : '#000000'
  const [draft, setDraft] = useState<Hsb>(() => hexToHsb(start))
  const [text, setText] = useState(props.value?.toLowerCase() ?? '')
  const [bad, setBad] = useState(false)
  const errorId = `${props.id}-error`

  // The release and Enter save the draft of that very moment, before React draws it.
  const draftNow = useRef(draft)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })

  useEffect(() => {
    hexField.current?.focus()
    const onPress = (event: PointerEvent) => {
      const target = event.target as Node
      const { openers, onClose } = latest.current
      if (box.current?.contains(target) || openers.some((o) => o.current?.contains(target))) return
      onClose(false)
    }
    document.addEventListener('pointerdown', onPress)
    return () => document.removeEventListener('pointerdown', onPress)
  }, [])

  function moveDraft(next: Hsb) {
    draftNow.current = next
    setDraft(next)
    setText(hsbToHex(next).toLowerCase())
    setBad(false)
  }

  function saveHex() {
    const hex = text.trim()
    if (HEX_COLOUR.test(hex)) {
      props.onSave(hex.toUpperCase())
      props.onClose(true)
    } else setBad(true)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      props.onClose(true)
    }
    if (event.key === 'Enter' && event.target === hexField.current) {
      event.preventDefault()
      saveHex()
    }
  }

  const save = () => props.onSave(hsbToHex(draftNow.current))

  return (
    <div
      ref={box}
      id={props.id}
      className={`${menuPlaceStyles.placed} ${styles.popover}`}
      onKeyDown={onKeyDown}
      {...place}
    >
      <ColourSquare draft={draft} onDraft={moveDraft} onSave={save} />
      <HueSlider draft={draft} onDraft={moveDraft} onSave={save} />
      <div className={styles.popRow}>
        <span
          className={picker.draft}
          data-testid="swatch-draft"
          style={{ background: hsbToHex(draft) }}
        />
        <input
          ref={hexField}
          className={styles.hex}
          aria-label="Hex colour"
          aria-invalid={bad}
          aria-describedby={bad ? errorId : undefined}
          spellCheck={false}
          value={text}
          onChange={(event) => {
            const typed = event.target.value
            setText(typed)
            setBad(false)
            if (HEX_COLOUR.test(typed.trim())) {
              draftNow.current = hexToHsb(typed.trim())
              setDraft(draftNow.current)
            }
          }}
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
