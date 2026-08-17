import { formatBytes } from "../services/index.js";

/**
 * @param {{ preview: import('../types/photochak').SortPreview }} props
 */
export function PreviewResult({ preview }) {
  const kind = preview.byKind || { photo: 0, video: 0, other: 0 };
  const est =
    (preview.bySource?.filename || 0) + (preview.bySource?.filedate || 0);
  const stats = [
    ["사진", kind.photo],
    ["동영상", kind.video],
    ["기타파일", kind.other],
  ];

  return (
    <>
      <div className="modal__counts">
        {stats.map(([label, n]) => (
          <div className="modal__stat" key={label}>
            <b>{n.toLocaleString()}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p>
        복사 예정 {(preview.total - preview.duplicates).toLocaleString()}개 ·
        중복 {preview.duplicates.toLocaleString()}개 · 미분류{" "}
        {(preview.bySource?.none || 0).toLocaleString()}개
      </p>
      <p>
        필요 용량 약 {formatBytes(preview.bytesNeeded)}
        {est ? ` · 날짜 추정 ${est.toLocaleString()}개` : ""}
      </p>
      <p className="modal__woof-note">
        기타파일은 사진·영상이 아닌 파일을 모아둘 곳이야 왈. 영상은 기본으로
        중복검사를 건너뛰어 배터리를 아낀다멍.
      </p>
    </>
  );
}
