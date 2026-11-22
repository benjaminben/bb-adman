// ED-2: the Type Section's summary names the chosen font. The font field already reads the
// project's fonts, so it tells the Type Section the name through this context instead of the
// Section asking again. Outside a Type Section nobody listens.
import { createContext, useContext, useEffect } from 'react'

export const FontNameContext = createContext<((name: string) => void) | null>(null)

export function useReportFontName(name: string | null): void {
  const report = useContext(FontNameContext)
  useEffect(() => {
    if (name !== null) report?.(name)
  }, [report, name])
}
