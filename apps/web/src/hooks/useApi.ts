import { useEffect, useState } from 'react'

export function useApi<T>(
  fn: () => Promise<T>,
  deps: any[] = [],
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    fn()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, deps)

  return { data, loading, error }
}
