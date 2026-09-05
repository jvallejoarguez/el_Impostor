import { createContext, useContext, useEffect, useState } from 'react'
import { secondsRemaining } from './serverClock.js'

export const ServerClockContext = createContext({ now: () => Date.now() })

export function useServerCountdown(end, duration) {
  const clock = useContext(ServerClockContext)
  const compute = () => secondsRemaining(end, clock.now(), duration)
  const [remaining, setRemaining] = useState(compute)
  useEffect(() => {
    setRemaining(compute())
    const interval = setInterval(() => setRemaining(compute()), 250)
    return () => clearInterval(interval)
  }, [end, duration, clock])
  return remaining
}
