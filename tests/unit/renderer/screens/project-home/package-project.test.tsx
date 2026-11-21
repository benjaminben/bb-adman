import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PackageProject } from '@/renderer/screens/project-home/package-project'
import { renderApp } from '../../render'

describe('"Package project…" on the project home [spec/screens-campaign.md, Package project]', () => {
  it('opens the package dialog, and Cancel closes it with focus back on the button', async () => {
    await renderApp(<PackageProject projectId="p1" />)
    const button = screen.getByRole('button', { name: 'Package project…' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(button)
    expect(screen.getByRole('dialog', { name: 'Package project' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(button).toHaveFocus()
  })
})
