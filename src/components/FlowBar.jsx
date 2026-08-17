/**
 * @param {{
 *   pct: number,
 *   busy?: boolean,
 *   done?: boolean,
 * }} props
 */
export function FlowBar({ pct, busy = false, done = false }) {
  const value = Math.max(0, Math.min(100, Number(pct) || 0));
  const width = value <= 0 && busy ? 10 : value;

  return (
    <div
      className={`flow-bar${busy ? " is-running" : ""}${done ? " is-done" : ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <div className="flow-bar__track" />
      <div className="flow-bar__fill" style={{ width: `${width}%` }}>
        <svg
          className="flow-bar__svg"
          viewBox="0 0 240 24"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="flow-bar__sine flow-bar__sine--a"
            d="M0 14 Q 20 2 40 14 T 80 14 T 120 14 T 160 14 T 200 14 T 240 14 V24 H0 Z"
          />
          <path
            className="flow-bar__sine flow-bar__sine--b"
            d="M0 16 Q 24 26 48 16 T 96 16 T 144 16 T 192 16 T 240 16 V24 H0 Z"
          />
        </svg>
        <span className="flow-bar__sheen" />
      </div>
    </div>
  );
}
