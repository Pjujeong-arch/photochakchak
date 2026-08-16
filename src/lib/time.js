/** @param {number} ms */
export function formatRemain(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec <= 1) return "곧 끝나요";
  if (sec < 60) return `약 ${sec}초 남음`;
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  if (minutes < 60) {
    return seconds ? `약 ${minutes}분 ${seconds}초 남음` : `약 ${minutes}분 남음`;
  }
  const hours = Math.floor(minutes / 60);
  const restMin = minutes % 60;
  return restMin ? `약 ${hours}시간 ${restMin}분 남음` : `약 ${hours}시간 남음`;
}
