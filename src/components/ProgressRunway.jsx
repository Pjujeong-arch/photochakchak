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
}) {
  const pomeRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const onRef = useRef(/** @type {HTMLImageElement | null} */ (null));
  const nextRef = useRef(/** @type {HTMLImageElement | null} */ (null));
  const frontIsOn = useRef(true);

  useEffect(() => {
    const el = pomeRef.current;
    if (!el || !el.parentElement) return;
    const max = Math.max(0, el.parentElement.clientWidth - el.offsetWidth);
    el.style.left = `${(pct / 100) * max}px`;
  }, [pct]);

  useEffect(() => {
    const href = actUrl(act);
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
  }, [act, actUrl]);

  return (
    <div className="progress-box">
      <div className="pome-runway" aria-hidden="true">
        <div className="pome-runway__path" />
        <div
          ref={pomeRef}
          className={`pome${busy ? " is-busy" : ""}${donePose ? " is-done" : ""}`}
          data-act={act}
        >
          <span className="pome__say">{say}</span>
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
