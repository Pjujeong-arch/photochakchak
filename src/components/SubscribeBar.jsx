/**
 * @param {{
 *   btnRef: import('react').RefObject<HTMLSpanElement | null>,
 *   showLogout: boolean,
 *   onLogout: () => void,
 *   loading?: boolean,
 *   authLoading?: boolean,
 *   error?: string | null,
 * }} props
 */
export function SubscribeBar({
  btnRef,
  showLogout,
  onLogout,
  loading = false,
  authLoading = false,
  error = null,
}) {
  const busy = loading || authLoading;

  return (
    <div className={`sub-bar${busy ? " is-loading" : ""}${error ? " has-error" : ""}`}>
      <div className="sub-bar__row">
        {busy ? <span className="sub-bar__spinner" aria-hidden="true" /> : null}
        <span
          className="sub-bar__gis"
          ref={btnRef}
          hidden={showLogout || authLoading}
        />
        {showLogout ? (
          <button
            className="btn btn--ghost"
            type="button"
            disabled={authLoading}
            onClick={onLogout}
          >
            {authLoading ? "처리 중…" : "로그아웃"}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="sub-bar__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
