/**
 * @param {{ message: string, visible: boolean }} props
 */
export function Toast({ message, visible }) {
  return (
    <div
      className={`toast${visible ? " is-visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
