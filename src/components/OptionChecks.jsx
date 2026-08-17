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
      <label className="check">
        <input
          type="checkbox"
          checked={opts.useFallbacks}
          disabled={disabled}
          onChange={(e) => onChange({ useFallbacks: e.target.checked })}
        />
        EXIF 없으면 파일명·파일 날짜로 추정 (카톡/캡처 대응)
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={opts.skipDuplicates}
          disabled={disabled}
          onChange={(e) => onChange({ skipDuplicates: e.target.checked })}
        />
        같은 사진은 하나만 복사 (32MB 이상은 앞·뒤 1MB만 비교, 절전)
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={opts.hashVideos}
          disabled={disabled}
          onChange={(e) => onChange({ hashVideos: e.target.checked })}
        />
        영상·1GB 이상도 중복 검사 (느림, 배터리 더 씀)
      </label>
    </>
  );
}
