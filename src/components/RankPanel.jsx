/**
 * @param {{
 *   months: string[],
 *   folder: string,
 *   from: string,
 *   to: string,
 *   consent: boolean,
 *   status: string,
 *   loading?: boolean,
 *   error?: string | null,
 *   result: import('../types/photochak').RankResult | null,
 *   meLabel?: string,
 *   onFolder: (v: string) => void,
 *   onFrom: (v: string) => void,
 *   onTo: (v: string) => void,
 *   onConsent: (v: boolean) => void,
 *   onSample: () => void,
 *   onTop10: () => void,
 *   onOpenSample: () => void,
 *   onOpenTop10: () => void,
 *   onOpenSubscribe: () => void,
 * }} props
 */
export function RankPanel({
  months,
  folder,
  from,
  to,
  consent,
  status,
  loading = false,
  error = null,
  result,
  meLabel,
  onFolder,
  onFrom,
  onTo,
  onConsent,
  onSample,
  onTop10,
  onOpenSample,
  onOpenTop10,
  onOpenSubscribe,
}) {
  return (
    <div className={`rank-box${loading ? " is-loading" : ""}`}>
      <p className="rank-box__lead">사진 추천 (선택)</p>
      <p className="rank-box__note">
        구독하시면 샘플·베스트 추천을 받을 수 있어요. 축소본만 Google AI로
        보내며 원본은 서버에 두지 않습니다.
      </p>
      {meLabel ? <p className="rank-user">{meLabel}</p> : null}
      <label className="check">
        <input
          type="checkbox"
          checked={consent}
          disabled={loading}
          onChange={(e) => onConsent(e.target.checked)}
        />
        축소본을 Google AI(Gemini)에 보내 구도·특징 평가에 쓰는 데 동의
      </label>
      <div className="rank-filters">
        <label>
          월 폴더
          <select
            value={folder}
            disabled={loading}
            onChange={(e) => onFolder(e.target.value)}
          >
            <option value="">전체 (이번 선택분)</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {[
          { label: "시작일", value: from, onChange: onFrom },
          { label: "종료일", value: to, onChange: onTo },
        ].map((row) => (
          <label key={row.label}>
            {row.label}
            <input
              type="date"
              value={row.value}
              disabled={loading}
              onChange={(e) => row.onChange(e.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="rank-actions">
        {[
          {
            className: "btn btn--safe",
            onClick: onSample,
            label: loading ? "추천 중…" : "샘플 추천 (인물 3 · 풍경 3)",
          },
          {
            className: "btn btn--start",
            onClick: onTop10,
            label: loading ? "분석 중…" : "베스트 10 (최대 20장 시연)",
          },
        ].map((btn) => (
          <button
            key={btn.className}
            className={btn.className}
            type="button"
            disabled={loading}
            onClick={btn.onClick}
          >
            {btn.label}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="rank-status rank-status--loading" aria-live="polite">
          <span className="sub-bar__spinner" aria-hidden="true" />
          {status || "요청을 처리하는 중…"}
        </p>
      ) : null}
      {!loading && status ? <p className="rank-status">{status}</p> : null}
      {error ? (
        <p className="rank-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="rank-actions rank-actions--view">
        {result
          ? [
              { label: "샘플 창 다시 보기", onClick: onOpenSample },
              { label: "베스트 10 창 다시 보기", onClick: onOpenTop10 },
            ].map((btn) => (
              <button
                key={btn.label}
                className="btn btn--ghost"
                type="button"
                onClick={btn.onClick}
              >
                {btn.label}
              </button>
            ))
          : null}
        <button className="btn btn--ghost" type="button" onClick={onOpenSubscribe}>
          구독 안내
        </button>
      </div>
    </div>
  );
}
