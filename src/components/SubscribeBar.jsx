/**
 * @param {{
 *   label: string,
 *   btnRef: import('react').RefObject<HTMLSpanElement | null>,
 *   showLogout: boolean,
 *   onLogout: () => void,
 *   loading?: boolean,
 *   authLoading?: boolean,
 *   error?: string | null,
 * }} props
 */
export function SubscribeBar({
  label,
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
        <span className="sub-bar__label">
          {busy ? <span className="sub-bar__spinner" aria-hidden="true" /> : null}
          {label}
        </span>
        <span ref={btnRef} hidden={showLogout || busy} />
        {showLogout ? (
          <button
            className="btn btn--ghost"
            type="button"
            disabled={busy}
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
