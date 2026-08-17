import { useEffect, useRef } from "react";

/**
 * @param {{
 *   pct: number,
 *   status: string,
 *   busy: boolean,
 *   donePose: boolean,
 *   act: string,
 *   say: string,
 *   actUrl: (id: string) => string,
 *   suppressed?: boolean,
 * }} props
 */
export function ProgressRunway({
  pct,
  status,
  busy,
  donePose,
  act,
  say,
  actUrl,
  suppressed = false,
}) {
  const pomeRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const onRef = useRef(/** @type {HTMLImageElement | null} */ (null));
  const nextRef = useRef(/** @type {HTMLImageElement | null} */ (null));
  const frontIsOn = useRef(true);
  const showBig = !suppressed && (busy || donePose);
  const poseAct = suppressed ? "idle" : act;
  const poseSay = suppressed ? "" : say;

  useEffect(() => {
    const el = pomeRef.current;
    const track = el?.parentElement;
    if (!el || !track) return;
    const size = showBig ? 118 : 59;
    const max = Math.max(0, track.clientWidth - size);
    const ratio = Math.max(0, Math.min(1, pct / 100));
    el.style.left = `${ratio * max}px`;
  }, [pct, busy, donePose, suppressed, showBig]);

  useEffect(() => {
    const href = actUrl(poseAct);
    const on = frontIsOn.current ? onRef.current : nextRef.current;
    const next = frontIsOn.current ? nextRef.current : onRef.current;
    if (!on || !next) return;
    if (on.classList.contains("is-on") && on.src === href) return;
    const reveal = () => {
      next.classList.add("is-on");
      on.classList.remove("is-on");
      frontIsOn.current = !frontIsOn.current;
      next.onload = null;
    };
    next.onload = reveal;
    if (next.complete && next.naturalWidth && next.src === href) reveal();
    else next.src = href;
  }, [poseAct, actUrl]);

  return (
    <div className={`progress-box${suppressed ? " is-suppressed" : ""}`}>
      <div
        className={`pome-runway${suppressed ? " is-suppressed" : ""}`}
        aria-hidden="true"
      >
        <div className="pome-runway__path" />
        <div
          ref={pomeRef}
          className={`pome${showBig ? " is-busy" : ""}${!suppressed && donePose ? " is-done" : ""}`}
          data-act={poseAct}
        >
          <span className="pome__say">{poseSay}</span>
          <span className="pome__hearts">
            <i />
            <i />
            <i />
          </span>
          <span className="pome__halo" />
          <img
            ref={onRef}
            className="pome__shot is-on"
            src={actUrl("idle")}
            alt=""
          />
          <img ref={nextRef} className="pome__shot" alt="" />
        </div>
      </div>
      <progress id="progress" max={100} value={pct} />
      <p>{status}</p>
    </div>
  );
}
