/** @typedef {"useFallbacks" | "skipDuplicates" | "hashVideos"} OptKey */

const CHECKS = /** @type {Array<{ key: OptKey, label: string }>} */ ([
  {
    key: "useFallbacks",
    label: "EXIF 없으면 파일명·파일 날짜로 추정 (카톡/캡처 대응)",
  },
  {
    key: "skipDuplicates",
    label: "같은 사진은 하나만 복사 (32MB 이상은 앞·뒤 1MB만 비교, 절전)",
  },
  {
    key: "hashVideos",
    label: "영상·1GB 이상도 중복 검사 (느림, 배터리 더 씀)",
  },
]);

/**
 * @param {{
 *   opts: { useFallbacks: boolean, skipDuplicates: boolean, hashVideos: boolean },
 *   onChange: (patch: Partial<{ useFallbacks: boolean, skipDuplicates: boolean, hashVideos: boolean }>) => void,
 *   disabled?: boolean,
 * }} props
 */
export function OptionChecks({ opts, onChange, disabled = false }) {
  return (
    <>
      {CHECKS.map((row) => (
        <label className="check" key={row.key}>
          <input
            type="checkbox"
            checked={opts[row.key]}
            disabled={disabled}
            onChange={(e) => onChange({ [row.key]: e.target.checked })}
          />
          {row.label}
        </label>
      ))}
    </>
  );
}
