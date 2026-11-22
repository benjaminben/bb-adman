// Z-1b fix 3: on a first-run step whose Settings part draws the same heading, the step's short
// name is seen once. The step's h2 keeps its name ("Step n of 3: …") and the focus; the InfoTip
// "About this step" stays visible; the part's own heading carries the words.
import { afterEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FirstRun, closeSetup } from '@/renderer/app/first-run'
import styles from '@/renderer/app/first-run/first-run.module.css'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'

afterEach(() => closeSetup())

function fresh() {
  const base = baseState()
  return makeFakeApi(baseState({ settings: { ...base.settings, setup: { done: false } } }))
}

async function goTo(step: number) {
  await userEvent.click(screen.getByRole('button', { name: 'Start' }))
  for (let i = 0; i < step; i += 1)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
}

// Text nodes holding exactly these words that are not inside words kept for a screen reader.
function seen(words: string) {
  const dialog = screen.getByRole('dialog', { name: 'Set up AdManager' })
  const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT)
  const found: Node[] = []
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.textContent?.trim() !== words) continue
    if (node.parentElement?.closest(`.${styles.hidden}, [hidden]`) === null) found.push(node)
  }
  return found.length
}

describe('a step name seen once [Z-1b]', () => {
  it.each([
    ['AI keys', 0, 'Step 1 of 3: AI keys'],
    ['ComfyUI server', 1, 'Step 2 of 3: ComfyUI server'],
    ['Cloud storage', 2, 'Step 3 of 3: Cloud storage'],
  ])('%s shows once, keeps its heading name, focus and tip', async (words, step, name) => {
    await renderApp(<FirstRun />, fresh())
    await goTo(step)
    expect(seen(words)).toBe(1)
    expect(screen.getByRole('heading', { name, level: 2 })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'About this step' })).toBeVisible()
    expect(await axeViolations()).toEqual([])
  })
})
