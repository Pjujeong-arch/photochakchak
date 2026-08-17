import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes } from "../services/index.js";
import { formatRemain } from "../utils/index.js";

const ACTS = [
  { id: "run", say: "폴짝폴짝 멍!" },
  { id: "cute", say: "재롱이야 ♡" },
  { id: "drink", say: "꿀꺽꿀꺽 왈" },
  { id: "lie", say: "눕는다개…" },
  { id: "sleep", say: "쿨쿨… 멍" },
  { id: "eat", say: "밥이다왈!" },
  { id: "bark", say: "멍멍멍!!" },
  { id: "highfive", say: "하이파이브!" },
  { id: "playdead", say: "죽는 시늉… 왈" },
  { id: "jump", say: "점프점프!" },
];

function actUrl(id) {
  return new URL(`img/runway/pome-act-${id}.png`, document.baseURI).href;
}

export function useProgress() {
  const [pct, setPctState] = useState(0);
  const [status, setStatus] = useState(
    "먼저 [미리보기]로 어떻게 분류될지·용량이 괜찮은지 확인하세요."
  );
  const [busy, setBusy] = useState(false);
  const [act, setAct] = useState("idle");
  const [say, setSay] = useState("멍!");
  const [donePose, setDonePose] = useState(false);
  const etaRate = useRef(/** @type {number | null} */ (null));
  const timer = useRef(0);
  const actIndex = useRef(0);

  useEffect(() => {
    ["idle"].concat(ACTS.map((a) => a.id)).forEach((id) => {
      const img = new Image();
      img.decoding = "async";
      img.src = actUrl(id);
    });
  }, []);

  const setPct = useCallback((value) => {
    setPctState(Math.max(0, Math.min(100, Number(value) || 0)));
  }, []);

  const resetEta = useCallback(() => {
    etaRate.current = null;
  }, []);

  const label = useCallback((done, total, startedAt, verb, extra) => {
    const percent = total ? Math.round((done / total) * 100) : 0;
    const head = verb ? `${verb} ` : "";
    const counts = `${head}${percent}% (${done.toLocaleString()}/${total.toLocaleString()})`;
    const fileBit =
      extra && extra.bytesTotal
        ? ` · ${formatBytes(extra.bytesWritten || 0)}/${formatBytes(extra.bytesTotal)}`
        : "";
    if (done >= total) return counts;
    const elapsed = performance.now() - startedAt;
    if (elapsed < 350) return `${counts} · 남은 시간 계산 중…${fileBit}`;
    const inst = Math.max(done, 0.25) / elapsed;
    etaRate.current =
      etaRate.current == null ? inst : etaRate.current * 0.72 + inst * 0.28;
    const remain =
      (total - Math.max(done, 0.25)) / Math.max(etaRate.current, 1e-9);
    const perSec = etaRate.current * 1000;
    const speed =
      total >= 200 && perSec >= 0.5
        ? ` · 초당 ${perSec.toFixed(perSec >= 10 ? 0 : 1)}개`
        : "";
    return `${counts} · ${formatRemain(remain)}${speed}${fileBit}`;
  }, []);

  const stopPome = useCallback(
    (resetting) => {
      if (timer.current) {
        window.clearInterval(timer.current);
        timer.current = 0;
      }
      if (resetting) return;
      const finished = pct >= 99.5;
      setDonePose(finished);
      setAct(finished ? "cute" : "idle");
      setSay(finished ? "다 했다멍 ♡" : "멍!");
    },
    [pct]
  );

  const startPome = useCallback(() => {
    stopPome(true);
    setDonePose(false);
    actIndex.current = 0;
    setAct(ACTS[0].id);
    setSay(ACTS[0].say);
    timer.current = window.setInterval(() => {
      actIndex.current = (actIndex.current + 1) % ACTS.length;
      const next = ACTS[actIndex.current];
      setAct(next.id);
      setSay(next.say);
    }, 1600);
  }, [stopPome]);

  const clearPose = useCallback(() => {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = 0;
    }
    setDonePose(false);
    setAct("idle");
    setSay("멍!");
  }, []);

  const setRunning = useCallback(
    (isBusy, opts = {}) => {
      setBusy(isBusy);
      if (isBusy) {
        resetEta();
        setPct(0);
        startPome();
        return;
      }
      if (opts.celebrate === false) clearPose();
      else stopPome(false);
    },
    [resetEta, setPct, startPome, stopPome, clearPose]
  );

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  return {
    pct,
    setPct,
    status,
    setStatus,
    busy,
    setRunning,
    clearPose,
    act,
    say,
    donePose,
    actUrl,
    label,
    resetEta,
  };
}
