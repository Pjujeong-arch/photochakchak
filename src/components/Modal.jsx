import { useEffect, useId } from "react";

/**
 * @param {{
 *   open: boolean,
 *   title: string,
 *   onClose: () => void,
 *   children: import('react').ReactNode,
 *   closeLabel?: string | null,
 *   layer?: "base" | "top",
 *   size?: "base" | "wide",
 * }} props
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  closeLabel = "확인",
  layer = "base",
  size = "base",
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`modal${layer === "top" ? " modal--top" : ""}${size === "wide" ? " modal--wide" : ""}`}
    >
      <div className="modal__backdrop" onClick={onClose} />
      <div
        className="modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        <div className="modal__body">{children}</div>
        {closeLabel ? (
          <button className="btn btn--start" type="button" onClick={onClose}>
            {closeLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
