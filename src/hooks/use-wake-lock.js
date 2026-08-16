/** @param {{ keepAwake: boolean, running: boolean }} state */
export function createWakeLock(state) {
  /** @type {WakeLockSentinel | null} */
  let sentinel = null;

  async function hold() {
    if (!state.keepAwake) return;
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    try {
      if (sentinel && sentinel.released === false) return;
      sentinel = await navigator.wakeLock.request("screen");
      sentinel.addEventListener("release", () => {
        if (state.running && state.keepAwake && document.visibilityState === "visible") hold();
      });
    } catch {
      sentinel = null;
    }
  }

  async function release() {
    state.keepAwake = false;
    const lock = sentinel;
    sentinel = null;
    if (lock) {
      try {
        await lock.release();
      } catch {
        /* ignore */
      }
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.running && state.keepAwake) hold();
  });

  return { hold, release };
}
