import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// A wait for something to appear gets five seconds, not one: several agents run the suite at
// once, and a busy machine must not fail a correct test. A test that passes is not slowed.
configure({ asyncUtilTimeout: 5000 })

afterEach(() => cleanup())
