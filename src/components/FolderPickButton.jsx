const FOLDER_PATH = (
  <path
    d="M3.5 8.5V7a2 2 0 0 1 2-2h4.2l1.6 1.8H18.5A2 2 0 0 1 20.5 9v8.2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V8.5Z"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinejoin="round"
  />
);

/**
 * @param {{
 *   variant: 'source' | 'dest',
 *   label: string,
 *   name: string,
 *   meta: string,
 *   picked: boolean,
 *   disabled?: boolean,
 *   onClick: () => void,
 * }} props
 */
export function FolderPickButton({
  variant,
  label,
  name,
  meta,
  picked,
  disabled = false,
  onClick,
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="field__row">
        <button
          className={`btn btn--pick${picked ? " is-picked" : ""}`}
          type="button"
          disabled={disabled}
          title={picked ? name : ""}
          onClick={onClick}
        >
          <span
            className={`pick__icon${variant === "dest" ? " pick__icon--dest" : ""}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none">
              {FOLDER_PATH}
              {variant === "dest" ? (
                <path
                  d="M12 11.2v6.2M9.4 15l2.6 2.4L14.6 15"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M3.5 10.5h17"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </span>
          <span className="pick__copy">
            <strong className="pick__name">{name}</strong>
            <span className="pick__meta">{meta}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
