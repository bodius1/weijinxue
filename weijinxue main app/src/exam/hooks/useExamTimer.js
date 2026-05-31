import { useCallback, useEffect, useRef, useState } from 'react'

export function useExamTimer(totalSeconds, onExpire) {
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  const start = useCallback(() => setIsRunning(true), [])
  const pause = useCallback(() => setIsRunning(false), [])
  const reset = useCallback(() => {
    expiredRef.current = false
    setSecondsRemaining(totalSeconds)
    setIsRunning(false)
  }, [totalSeconds])

  useEffect(() => {
    setSecondsRemaining(totalSeconds)
    expiredRef.current = false
  }, [totalSeconds])

  useEffect(() => {
    if (!isRunning) return undefined
    const id = window.setInterval(() => {
      setSecondsRemaining((s) => {
        if (s <= 1) {
          window.clearInterval(id)
          if (!expiredRef.current) {
            expiredRef.current = true
            queueMicrotask(() => onExpireRef.current?.())
          }
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [isRunning])

  return { secondsRemaining, isRunning, start, pause, reset }
}
