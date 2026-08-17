import { useCallback, useEffect, useRef } from "react";

/**
 * @param {{ running: boolean, keepAwake: boolean }} flags
 */
export function useWakeLock(flags) {
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  /** @type {React.MutableRefObject<WakeLockSentinel | null>} */
  const sentinel = useRef(null);

  const hold = useCallback(async () => {
    if (!flagsRef.current.keepAwake) return;
    if (!navigator.wakeLock?.request) return;
    try {
      if (sentinel.current && sentinel.current.released === false) return;
      sentinel.current = await navigator.wakeLock.request("screen");
      sentinel.current.addEventListener("release", () => {
        if (
          flagsRef.current.running &&
          flagsRef.current.keepAwake &&
          document.visibilityState === "visible"
        ) {
          hold();
        }
      });
    } catch {
      sentinel.current = null;
    }
  }, []);

  const release = useCallback(async () => {
    const lock = sentinel.current;
    sentinel.current = null;
    if (lock) {
      try {
        await lock.release();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (
        document.visibilityState === "visible" &&
        flagsRef.current.running &&
        flagsRef.current.keepAwake
      ) {
        hold();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [hold]);

  return { hold, release };
}
