import { analyzeFiles, copyToDirectory, copyToZip, formatBytes, undoLastRun } from "../services/index.js";
import { canPickDir } from "./use-folders.js";

function options(els, state) {
  const flags = {
    skipDuplicates: els.skipDup.checked,
    hashVideos: Boolean(els.videoDup && els.videoDup.checked),
    useFallbacks: els.fallback.checked,
  };
  const preview = state.preview;
  const same =
    preview &&
    preview.items &&
    preview.planFlags &&
    preview.planFlags.skipDuplicates === flags.skipDuplicates &&
    preview.planFlags.hashVideos === flags.hashVideos &&
    preview.planFlags.useFallbacks === flags.useFallbacks;
  return { ...flags, planItems: same ? preview.items : null, cancelled: () => state.cancelled };
}

function doneSummary(stats) {
  return `완료 — EXIF ${stats.ok.toLocaleString()} · 추정 ${stats.estimated.toLocaleString()} · 미분류 ${stats.unclassified.toLocaleString()} · 기타 ${(stats.other || 0).toLocaleString()} · 중복스킵 ${stats.duplicate.toLocaleString()} · 실패 ${stats.error.toLocaleString()}`;
}

function woofTips(kind) {
  const where = kind === "zip" ? "ZIP을 잘 받아뒀는지" : "새 폴더에 잘 들어왔는지";
  return `<div class="modal__woof">
    <p>다 복사했다멍! <b>기타파일</b>은 사진이랑 동영상이 아닌 파일을 모아둔 바구니야 왈.</p>
    <p>${where} 한 번만 킁킁 해보고, 괜찮으면 <b>예전 폴더는 지워도 된다개</b>. 그래야 용량이 절약돼 왈왈!</p>
    <p class="modal__woof-note">원본은 내가 안 지워~ 네가 직접 지우는 거야. 마음에 안 들면 「실행 취소」다멍.</p>
  </div>`;
}

function kindStatsHtml(kind) {
  return [
    ["사진", kind.photo],
    ["동영상", kind.video],
    ["기타파일", kind.other],
  ]
    .map(([label, n]) => `<div class="modal__stat"><b>${n.toLocaleString()}</b><span>${label}</span></div>`)
    .join("");
}

export function bindSort(els, state, { toast, modal, progress, pome, wakeLock }) {
  function setBusy(busy) {
    state.running = busy;
    [els.previewBtn, els.startBtn, els.zipBtn, els.undoBtn, els.sourceBtn].forEach((btn) => {
      if (btn) btn.disabled = busy;
    });
    if (els.destBtn) els.destBtn.disabled = busy || !canPickDir();
    if (els.cancelBtn) els.cancelBtn.disabled = !busy;
    if (busy) {
      progress.resetEta();
      progress.setPct(0);
      pome.start();
    } else pome.stop();
  }

  function onTick(startedAt, done, total, extra, verb) {
    progress.setPct(total ? (done / total) * 100 : 0);
    els.status.textContent = progress.label(done, total, startedAt, verb || "", extra);
  }

  async function runPreview() {
    if (state.running) return;
    if (!state.files.length) return toast.show("정리할 사진 폴더를 먼저 선택해 주세요.");
    state.cancelled = false;
    setBusy(true);
    const startedAt = performance.now();
    els.status.textContent = "분석 시작 · 남은 시간 계산 중…";
    try {
      const result = await analyzeFiles(state.files, options(els, state), (done, total) => {
        onTick(startedAt, done, total, undefined, "분석 중");
      });
      state.preview = result;
      const kind = result.byKind || { photo: 0, video: 0, other: 0 };
      const est = (result.bySource.filename || 0) + (result.bySource.filedate || 0);
      els.status.textContent = `미리보기 완료 — 사진 ${kind.photo.toLocaleString()} · 영상 ${kind.video.toLocaleString()} · 기타 ${kind.other.toLocaleString()}`;
      progress.setPct(result.total ? 100 : 0);
      modal.open(
        "미리보기 결과",
        `<div class="modal__counts">${kindStatsHtml(kind)}</div>
        <p>복사 예정 ${(result.total - result.duplicates).toLocaleString()}개 · 중복 ${result.duplicates.toLocaleString()}개 · 미분류 ${(result.bySource.none || 0).toLocaleString()}개</p>
        <p>필요 용량 약 ${formatBytes(result.bytesNeeded)}${est ? ` · 날짜 추정 ${est.toLocaleString()}개` : ""}</p>
        <p class="modal__woof-note">기타파일은 사진·영상이 아닌 파일을 모아둘 곳이야 왈. 영상은 기본으로 중복검사를 건너뛰어 배터리를 아낀다멍.</p>`
      );
    } catch (err) {
      els.status.textContent =
        String(/** @type {Error} */ (err).message) === "cancelled_preview"
          ? "미리보기를 중지했습니다."
          : "오류로 중단 — 원본 유지";
    } finally {
      setBusy(false);
    }
  }

  function confirmCopy(kind) {
    if (!state.preview) return window.confirm("아직 미리보기를 안 하셨습니다.\n그래도 바로 복사할까요?");
    const needed = state.preview.bytesNeeded;
    const copyCount = state.preview.total - state.preview.duplicates;
    return window.confirm(
      `${kind}을 시작합니다.\n· 복사 예정: ${copyCount.toLocaleString()}장\n· 중복 스킵: ${state.preview.duplicates.toLocaleString()}장\n· 필요 용량: 약 ${formatBytes(needed)}\n\n원본은 그대로 두고 복사만 합니다.`
    );
  }

  /**
   * @param {{
   *   needDest?: boolean,
   *   confirmLabel: string,
   *   startText: string,
   *   title: string,
   *   tipKind: "folder" | "zip",
   *   run: (startedAt: number) => Promise<{ stats: import("../types/photochak").SortStats, skipped: unknown[], blob?: Blob }>
   * }} spec
   */
  async function runJob(spec) {
    if (state.running) return;
    if (!state.files.length) return toast.show("정리할 사진 폴더를 먼저 선택해 주세요.");
    if (spec.needDest && !state.destHandle) return toast.show("저장 폴더를 선택하거나 ZIP으로 받으세요.");
    if (!confirmCopy(spec.confirmLabel)) return;
    state.cancelled = false;
    setBusy(true);
    state.keepAwake = true;
    await wakeLock.hold();
    const startedAt = performance.now();
    els.status.textContent = spec.startText;
    try {
      const { stats, skipped, blob } = await spec.run(startedAt);
      if (blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "포토착착_정리본.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      }
      const summary = doneSummary(stats);
      els.status.textContent = summary;
      modal.open(spec.title, `<p>${summary}</p>${woofTips(spec.tipKind)}${modal.skippedTable(skipped)}`);
    } catch {
      els.status.textContent = "오류로 중단 — 원본 유지";
    } finally {
      await wakeLock.release();
      setBusy(false);
    }
  }

  async function runUndo() {
    if (state.running) return;
    if (!state.destHandle) return toast.show("저장 폴더를 선택한 뒤에 실행 취소할 수 있습니다.");
    if (!window.confirm("지난 실행에서 복사한 파일만 삭제합니다.\n원본 사진은 절대 건드리지 않습니다.")) return;
    setBusy(true);
    try {
      const { deleted } = await undoLastRun(state.destHandle);
      els.status.textContent = `실행 취소 완료 — ${deleted.toLocaleString()}개 복사본 삭제 (원본 유지)`;
      toast.show("이번 복사본만 되돌렸습니다.");
    } catch (err) {
      toast.show(/** @type {Error} */ (err).message || String(err));
    } finally {
      setBusy(false);
    }
  }

  els.previewBtn.addEventListener("click", runPreview);
  els.startBtn.addEventListener("click", () =>
    runJob({
      needDest: true,
      confirmLabel: "폴더 복사",
      startText: "분류 시작 · 절전 방지 · 남은 시간 계산 중…",
      title: "분류 결과",
      tipKind: "folder",
      run: (startedAt) =>
        copyToDirectory(state.files, state.destHandle, options(els, state), (done, total, _msg, extra) =>
          onTick(startedAt, done, total, extra)
        ),
    })
  );
  els.zipBtn.addEventListener("click", () =>
    runJob({
      confirmLabel: "ZIP 받기",
      startText: "ZIP 시작 · 절전 방지 · 남은 시간 계산 중…",
      title: "ZIP 결과",
      tipKind: "zip",
      run: (startedAt) =>
        copyToZip(state.files, options(els, state), (done, total, _msg, extra) => onTick(startedAt, done, total, extra)),
    })
  );
  els.undoBtn.addEventListener("click", runUndo);
  els.cancelBtn.addEventListener("click", () => {
    if (!state.running) return;
    state.cancelled = true;
    els.status.textContent = "중지 요청… 현재 파일만 마치고 멈춥니다.";
  });

  setBusy(false);
  pome.place(Number(els.progress.value) || 0);
  window.addEventListener("resize", () => pome.place(Number(els.progress.value) || 0));
}
