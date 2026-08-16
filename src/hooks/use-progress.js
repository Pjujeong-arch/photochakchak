import { formatRemain } from "../lib/index.js";
import { formatBytes } from "../services/index.js";

export function createProgress(els, pome) {
  /** @type {number | null} */
  let etaRate = null;

  function setPct(pct) {
    const value = Math.max(0, Math.min(100, Number(pct) || 0));
    if (els.progress) els.progress.value = value;
    pome.place(value);
  }

  function resetEta() {
    etaRate = null;
  }

  function label(done, total, startedAt, verb, extra) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const head = verb ? `${verb} ` : "";
    const counts = `${head}${pct}% (${done.toLocaleString()}/${total.toLocaleString()})`;
    const fileBit =
      extra && extra.bytesTotal
        ? ` · ${formatBytes(extra.bytesWritten || 0)}/${formatBytes(extra.bytesTotal)}`
        : "";
    if (done >= total) return counts;
    const elapsed = performance.now() - startedAt;
    if (elapsed < 350) return `${counts} · 남은 시간 계산 중…${fileBit}`;
    const inst = Math.max(done, 0.25) / elapsed;
    etaRate = etaRate == null ? inst : etaRate * 0.72 + inst * 0.28;
    const remain = (total - Math.max(done, 0.25)) / Math.max(etaRate, 1e-9);
    const perSec = etaRate * 1000;
    const speed = total >= 200 && perSec >= 0.5 ? ` · 초당 ${perSec.toFixed(perSec >= 10 ? 0 : 1)}개` : "";
    return `${counts} · ${formatRemain(remain)}${speed}${fileBit}`;
  }

  return { setPct, resetEta, label };
}
