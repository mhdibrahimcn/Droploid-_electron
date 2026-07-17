import { useState, useEffect } from 'react'
import { ipc } from './ipc'

const cache = new Map<string, string | null>()

export function useAppIcon(iconPath: string | undefined): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(() => {
    if (!iconPath) return null
    return cache.get(iconPath) ?? null
  })

  useEffect(() => {
    if (!iconPath) return
    if (cache.has(iconPath)) {
      setDataUrl(cache.get(iconPath) ?? null)
      return
    }
    ipc.invoke<string | null>('app:get-icon', { iconPath }).then((url) => {
      cache.set(iconPath, url)
      setDataUrl(url)
    })
  }, [iconPath])

  return dataUrl
}
