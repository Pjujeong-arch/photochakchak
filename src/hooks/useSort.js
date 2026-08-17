import { useCallback, useRef, useState } from "react";
import {
  analyzeFiles,
  copyToDirectory,
  copyToZip,
  formatBytes,
  undoLastRun,
} from "../services/index.js";
import { doneSummary } from "../utils/index.js";

/**
 * @param {{
 *   files: File[],
 *   destHandle: FileSystemDirectoryHandle | null,
 *   toast: { show: (msg: string) => void },
 *   progress: ReturnType<typeof import('./useProgress.js').useProgress>,
 *   wakeLock: { hold: () => Promise<void>, release: () => Promise<void> },
 *   setKeepAwake: (v: boolean) => void,
 *   onCopyStarted?: () => void,
 *   onCopyFinished?: () => void,
 * }} args
 */
export function useSort({
  files,
  destHandle,
  toast,
  progress,
  wakeLock,
  setKeepAwake,
  onCopyStarted,
  onCopyFinished,
}) {
  const [preview, setPreview] = useState(
    /** @type {import('../types/photochak').SortPreview | null} */ (null)
  );
  const [modal, setModal] = useState(
    /** @type {import('../types/photochak').ModalView} */ ({ kind: "none" })
  );
  const [opts, setOpts] = useState({
    useFallbacks: true,
    skipDuplicates: true,
    hashVideos: false,
  });
  const cancelled = useRef(false);
  const running = useRef(false);

  const closeModal = useCallback(() => setModal({ kind: "none" }), []);

  const buildOptions = useCallback(() => {
    const same =
      preview &&
      preview.items &&
      preview.planFlags &&
      preview.planFlags.skipDuplicates === opts.skipDuplicates &&
      preview.planFlags.hashVideos === opts.hashVideos &&
      preview.planFlags.useFallbacks === opts.useFallbacks;
    return {
      ...opts,
      planItems: same ? preview.items : null,
      cancelled: () => cancelled.current,
    };
  }, [opts, preview]);

  const onTick = useCallback(
    (startedAt, done, total, extra, verb) => {
      progress.setPct(total ? (done / total) * 100 : 0);
      progress.setStatus(progress.label(done, total, startedAt, verb || "", extra));
    },
    [progress]
  );

  const runPreview = useCallback(async () => {
    if (running.current) return;
    if (!files.length) return toast.show("정리할 사진 폴더를 먼저 선택해 주세요.");
    cancelled.current = false;
    running.current = true;
    progress.setRunning(true);
    const startedAt = performance.now();
    progress.setStatus("분석 시작 · 남은 시간 계산 중…");
    try {
      const result = await analyzeFiles(files, buildOptions(), (done, total) => {
        onTick(startedAt, done, total, undefined, "분석 중");
      });
      setPreview(result);
      const kind = result.byKind || { photo: 0, video: 0, other: 0 };
      progress.setStatus(
        `미리보기 완료 — 사진 ${kind.photo.toLocaleString()} · 영상 ${kind.video.toLocaleString()} · 기타 ${kind.other.toLocaleString()}`
      );
      progress.setPct(result.total ? 100 : 0);
      setModal({ kind: "preview", title: "미리보기 결과", preview: result });
    } catch (err) {
      progress.setStatus(
        String(/** @type {Error} */ (err).message) === "cancelled_preview"
          ? "미리보기를 중지했습니다."
          : "오류로 중단 — 원본 유지"
      );
    } finally {
      running.current = false;
      progress.setRunning(false, { celebrate: false });
    }
  }, [files, toast, progress, buildOptions, onTick]);

  const confirmCopy = useCallback(
    (kind) => {
      if (!preview) {
        return window.confirm(
          "아직 미리보기를 안 하셨습니다.\n그래도 바로 복사할까요?"
        );
      }
      const copyCount = preview.total - preview.duplicates;
      return window.confirm(
        `${kind}을 시작합니다.\n· 복사 예정: ${copyCount.toLocaleString()}장\n· 중복 스킵: ${preview.duplicates.toLocaleString()}장\n· 필요 용량: 약 ${formatBytes(preview.bytesNeeded)}\n\n원본은 그대로 두고 복사만 합니다.`
      );
    },
    [preview]
  );

  const runJob = useCallback(
    async (spec) => {
      if (running.current) return;
      if (!files.length) return toast.show("정리할 사진 폴더를 먼저 선택해 주세요.");
      if (spec.needDest && !destHandle) {
        return toast.show("저장 폴더를 선택하거나 ZIP으로 받으세요.");
      }
      if (!confirmCopy(spec.confirmLabel)) return;
      spec.onStarted?.();
      cancelled.current = false;
      running.current = true;
      progress.setRunning(true);
      setKeepAwake(true);
      await wakeLock.hold();
      const startedAt = performance.now();
      progress.setStatus(spec.startText);
      try {
        const { stats, skipped, blob } = await spec.run(startedAt);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "포토착착_정리본.zip";
          a.rel = "noopener";
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          window.setTimeout(() => {
            a.remove();
            URL.revokeObjectURL(url);
          }, 60000);
        }
        const summary = doneSummary(stats);
        progress.setStatus(summary);
        setModal({
          kind: "done",
          title: spec.title,
          tipKind: spec.tipKind,
          summary,
          skipped: /** @type {import('../types/photochak').SkippedItem[]} */ (
            skipped || []
          ),
        });
        spec.onFinished?.();
      } catch {
        progress.setStatus("오류로 중단 — 원본 유지");
      } finally {
        setKeepAwake(false);
        await wakeLock.release();
        running.current = false;
        progress.setRunning(false);
      }
    },
    [files, destHandle, toast, confirmCopy, progress, setKeepAwake, wakeLock]
  );

  const runCopy = useCallback(() => {
    runJob({
      needDest: true,
      confirmLabel: "폴더 복사",
      startText: "분류 시작 · 절전 방지 · 남은 시간 계산 중…",
      title: "분류 결과",
      tipKind: "folder",
      onStarted: onCopyStarted,
      onFinished: onCopyFinished,
      run: (startedAt) =>
        copyToDirectory(files, destHandle, buildOptions(), (done, total, _msg, extra) =>
          onTick(startedAt, done, total, extra)
        ),
    });
  }, [runJob, files, destHandle, buildOptions, onTick, onCopyStarted, onCopyFinished]);

  const runZip = useCallback(() => {
    runJob({
      confirmLabel: "ZIP 받기",
      startText: "ZIP 시작 · 절전 방지 · 남은 시간 계산 중…",
      title: "ZIP 결과",
      tipKind: "zip",
      onStarted: onCopyStarted,
      onFinished: onCopyFinished,
      run: (startedAt) =>
        copyToZip(files, buildOptions(), (done, total, _msg, extra) =>
          onTick(startedAt, done, total, extra)
        ),
    });
  }, [runJob, files, buildOptions, onTick, onCopyStarted, onCopyFinished]);

  const runUndo = useCallback(async () => {
    if (running.current) return;
    if (!destHandle) {
      return toast.show("저장 폴더를 선택한 뒤에 실행 취소할 수 있습니다.");
    }
    if (
      !window.confirm(
        "지난 실행에서 복사한 파일만 삭제합니다.\n원본 사진은 절대 건드리지 않습니다."
      )
    ) {
      return;
    }
    running.current = true;
    progress.setRunning(true);
    try {
      const { deleted } = await undoLastRun(destHandle);
      progress.setStatus(
        `실행 취소 완료 — ${deleted.toLocaleString()}개 복사본 삭제 (원본 유지)`
      );
      toast.show("이번 복사본만 되돌렸습니다.");
    } catch (err) {
      toast.show(/** @type {Error} */ (err).message || String(err));
    } finally {
      running.current = false;
      progress.setRunning(false);
    }
  }, [destHandle, toast, progress]);

  const cancel = useCallback(() => {
    if (!running.current) return;
    cancelled.current = true;
    progress.setStatus("중지 요청… 현재 파일만 마치고 멈춥니다.");
  }, [progress]);

  const clearPreview = useCallback(() => setPreview(null), []);

  return {
    preview,
    setPreview,
    clearPreview,
    modal,
    closeModal,
    opts,
    setOpts,
    runPreview,
    runCopy,
    runZip,
    runUndo,
    cancel,
  };
}
