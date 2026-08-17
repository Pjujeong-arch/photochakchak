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
  return (
    <div className="app-actions">
      <div className="app-flow">
        <button
          className="btn btn--safe"
          type="button"
          disabled={busy}
          onClick={onPreview}
        >
          ① 미리보기 (복사 안 함)
        </button>
        <button
          className="btn btn--start"
          type="button"
          disabled={busy}
          onClick={onStart}
        >
          ② 자동 분류 시작
        </button>
      </div>
      <button className="btn btn--zip" type="button" disabled={busy} onClick={onZip}>
        ZIP으로 받기
      </button>
      <button className="btn btn--undo" type="button" disabled={busy} onClick={onUndo}>
        실행 취소
      </button>
      <button
        className="btn btn--stop"
        type="button"
        disabled={!busy}
        onClick={onCancel}
      >
        중지
      </button>
    </div>
  );
}
