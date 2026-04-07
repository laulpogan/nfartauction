import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'

export type Neighborhood = 'gallery' | 'warehouse' | 'flatlands' | 'hotel' | 'online'

interface NeighborhoodContextValue {
  neighborhood: Neighborhood
  accentVar: string
}

const NeighborhoodContext = createContext<NeighborhoodContextValue | null>(null)

export function useNeighborhood(): NeighborhoodContextValue {
  const ctx = useContext(NeighborhoodContext)
  if (!ctx) {
    throw new Error('useNeighborhood must be used inside a <NeighborhoodProvider>')
  }
  return ctx
}

interface NeighborhoodProviderProps {
  neighborhood: Neighborhood
  children: ReactNode
}

export function NeighborhoodProvider({ neighborhood, children }: NeighborhoodProviderProps) {
  const accentVar = `var(--color-${neighborhood})`
  const value: NeighborhoodContextValue = { neighborhood, accentVar }
  const style = { '--color-accent': accentVar } as CSSProperties

  return (
    <NeighborhoodContext.Provider value={value}>
      <div
        data-testid="neighborhood-root"
        data-neighborhood={neighborhood}
        className={neighborhood === 'online' ? 'neighborhood-online' : undefined}
        style={style}
      >
        {children}
      </div>
    </NeighborhoodContext.Provider>
  )
}
