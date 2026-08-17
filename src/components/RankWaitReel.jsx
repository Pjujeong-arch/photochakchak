import { useEffect, useRef, useState } from "react";

const STEP = 10;
const HOLD = 70;
const STEP_MS = 320;
const FINALE_MS = 3000;
const GLEAM_BEFORE_MS = 2000;

function holdTarget(pct) {
  return Math.min(HOLD, Math.round(Math.max(0, pct) / STEP) * STEP);
}

/**
 * @param {{
 *   status?: string,
 *   pct?: number,
 *   loading?: boolean,
 *   onFilled?: () => void,
 * }} props
 */
export function RankWaitReel({
  status = "",
  pct = 0,
  loading = true,
  onFilled,
}) {
  const [fill, setFill] = useState(0);
  const [gleam, setGleam] = useState(false);
  const [done, setDone] = useState(false);
  const fillRef = useRef(0);
  fillRef.current = fill;

  useEffect(() => {
    if (!loading || done) return undefined;
    const target = holdTarget(pct);
    if (fill >= target) return undefined;
    const t = window.setTimeout(() => {
      setFill((n) => Math.min(target, n + STEP));
    }, STEP_MS);
    return () => window.clearTimeout(t);
  }, [loading, pct, fill, done]);

  useEffect(() => {
    if (loading) return undefined;
    const from = fillRef.current;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - t0;
      const p = Math.min(1, elapsed / FINALE_MS);
      setFill(Math.min(100, Math.ceil((from + (100 - from) * p) / STEP) * STEP));
      setGleam(FINALE_MS - elapsed <= GLEAM_BEFORE_MS);
      if (p >= 1) {
        window.clearInterval(id);
        setFill(100);
        setDone(true);
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!done) return undefined;
    const t = window.setTimeout(() => onFilled?.(), 720);
    return () => window.clearTimeout(t);
  }, [done, onFilled]);

  return (
    <div className={`rank-wait${gleam ? " is-gleam" : ""}${done ? " is-done" : ""}`}>
      <div
        className="rank-wait__pome"
        aria-hidden="true"
        style={{ "--fill": `${fill}%` }}
      >
        <span className="rank-wait__paint" />
        <span className="rank-wait__outline" />
        <img
          className="rank-wait__photo"
          src="/img/runway/pome-act-idle.png"
          alt=""
        />
        <span className="rank-wait__eye" />
      </div>
      <p className="rank-wait__status" aria-live="polite">
        {status || "Gemini가 축소본을 읽는 중…"}
      </p>
    </div>
  );
}
