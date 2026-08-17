/**
 * @param {{
 *   busy: boolean,
 *   onPreview: () => void,
 *   onStart: () => void,
 *   onZip: () => void,
 *   onUndo: () => void,
 *   onCancel: () => void,
 * }} props
 */
export function ActionBar({
  busy,
  onPreview,
  onStart,
  onZip,
  onUndo,
  onCancel,
}) {
  const flow = [
    { className: "btn btn--safe", onClick: onPreview, label: "① 미리보기 (복사 안 함)" },
    { className: "btn btn--start", onClick: onStart, label: "② 자동 분류 시작" },
  ];
  const extra = [
    { className: "btn btn--zip", onClick: onZip, label: "ZIP으로 받기", disabled: busy },
    { className: "btn btn--undo", onClick: onUndo, label: "실행 취소", disabled: busy },
    { className: "btn btn--stop", onClick: onCancel, label: "중지", disabled: !busy },
  ];

  return (
    <div className="app-actions">
      <div className="app-flow">
        {flow.map((btn) => (
          <button
            key={btn.label}
            className={btn.className}
            type="button"
            disabled={busy}
            onClick={btn.onClick}
          >
            {btn.label}
          </button>
        ))}
      </div>
      {extra.map((btn) => (
        <button
          key={btn.label}
          className={btn.className}
          type="button"
          disabled={btn.disabled}
          onClick={btn.onClick}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
