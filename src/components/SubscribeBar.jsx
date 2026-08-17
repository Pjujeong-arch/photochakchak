import { useLayoutEffect } from "react";

/**
 * @param {{
 *   btnRef: import('react').RefObject<HTMLSpanElement | null>,
 *   showLogout: boolean,
 *   onLogout: () => void,
 *   onPaint?: () => void,
 *   loading?: boolean,
 *   authLoading?: boolean,
 *   error?: string | null,
 * }} props
 */
export function SubscribeBar({
  btnRef,
  showLogout,
  onLogout,
  onPaint,
  loading = false,
  authLoading = false,
  error = null,
}) {
  const busy = loading || authLoading;

  useLayoutEffect(() => {
    if (showLogout) return undefined;
    onPaint?.();
    return undefined;
  }, [showLogout, onPaint]);

  return (
    <div className={`sub-bar${busy ? " is-loading" : ""}${error ? " has-error" : ""}`}>
      <div className="sub-bar__row">
        {busy ? <span className="sub-bar__spinner" aria-hidden="true" /> : null}
        {showLogout ? (
          <button
            className="btn btn--ghost"
            type="button"
            disabled={authLoading}
            onClick={onLogout}
          >
            {authLoading ? "처리 중…" : "로그아웃"}
          </button>
        ) : (
          <span className="sub-bar__gis" ref={btnRef} />
        )}
      </div>
      {error ? (
        <p className="sub-bar__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
