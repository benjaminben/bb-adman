// Imported first by cw-7-scenes.tsx, before any schema is made. The scene's bundle is loaded
// through the debugging channel, where zod's own test finds that it may build code from text;
// the page's script policy then refuses that code. Not a test file.
import { z } from 'zod'

z.config({ jitless: true })
