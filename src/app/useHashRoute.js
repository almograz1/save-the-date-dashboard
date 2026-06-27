import { useEffect, useState } from 'react'

const readHashRoute = (fallback) => {
  if (typeof window === 'undefined') return fallback
  return window.location.hash.replace(/^#\/?/, '') || fallback
}

// Lightweight hash router: keeps URL/back-button behavior without adding a router dependency.
export function useHashRoute(fallback) {
  const [route, setRoute] = useState(() => readHashRoute(fallback))

  useEffect(() => {
    const onHash = () => setRoute(readHashRoute(fallback))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [fallback])

  return route
}
