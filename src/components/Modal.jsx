import { useEffect } from "react";

/**
 * @param {{
 *   open: boolean,
 *   title: string,
 *   onClose: () => void,
 *   children: import('react').ReactNode,
 * }} props
 */
export function Modal({ open, title, onClose, children }) {
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
    <div className="modal">
      <div className="modal__backdrop" onClick={onClose} />
      <div
        className="modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 className="modal__title" id="modal-title">
          {title}
        </h2>
        <div className="modal__body">{children}</div>
        <button className="btn btn--start" type="button" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}
