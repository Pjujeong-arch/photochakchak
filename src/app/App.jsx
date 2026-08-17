import { useEffect, useState } from "react";
import {
  ActionBar,
  FolderPickButton,
  Modal,
  OptionChecks,
  PreviewResult,
  ProgressRunway,
  RankPanel,
  Reel,
  SiteFooter,
  SkippedList,
  StorageTips,
  SubscribeBar,
  Toast,
} from "../components/index.js";
import {
  useFolders,
  useProgress,
  useRank,
  useSort,
  useSubscribe,
  useToast,
  useWakeLock,
} from "../hooks/index.js";

export default function App() {
  const toast = useToast();
  const folders = useFolders(toast);
  const progress = useProgress();
  const [keepAwake, setKeepAwake] = useState(false);
  const wakeLock = useWakeLock({
    running: progress.busy,
    keepAwake,
  });
  const subscribe = useSubscribe(toast);
  const {
    preview,
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
  } = useSort({
    files: folders.files,
    destHandle: folders.destHandle,
    toast,
    progress,
    wakeLock,
    setKeepAwake,
  });
  const rank = useRank({
    files: folders.files,
    preview,
    me: subscribe.me,
    toast,
  });

  useEffect(() => {
    clearPreview();
  }, [folders.files, folders.destHandle, clearPreview]);

  const modalOpen = modal.kind !== "none";
  const modalTitle = modal.kind === "none" ? "" : modal.title;

  return (
    <>
      <div className="layout">
        <main>
          <Reel />
          <section className="section section--app" id="app">
            <h1 className="app-title">사진·영상 정리</h1>
            <div className="app-panel">
              <SubscribeBar
                label={subscribe.label}
                btnRef={subscribe.btnRef}
                showLogout={Boolean(subscribe.me?.email)}
                onLogout={subscribe.logout}
                loading={subscribe.loading}
                authLoading={subscribe.authLoading}
                error={subscribe.error}
              />
              <div className="folder-picks">
                <FolderPickButton
                  variant="source"
                  label="[1] 정리할 폴더 (사진·영상·기타)"
                  name={folders.sourcePick.name}
                  meta={folders.sourcePick.meta}
                  picked={folders.sourcePick.picked}
                  disabled={progress.busy}
                  onClick={folders.openSourcePicker}
                />
                <input
                  ref={folders.inputRef}
                  id="source-input"
                  type="file"
                  multiple
                  hidden
                  {...{ webkitdirectory: "", directory: "" }}
                  onChange={folders.onSourceChange}
                />
                <FolderPickButton
                  variant="dest"
                  label="[2] 정리본 저장 폴더 (원본과 다른 위치, 연도월·미분류·기타파일)"
                  name={folders.destPick.name}
                  meta={folders.destPick.meta}
                  picked={folders.destPick.picked}
                  disabled={progress.busy || !folders.dirSupported}
                  onClick={folders.pickDest}
                />
              </div>
              <OptionChecks
                opts={opts}
                disabled={progress.busy}
                onChange={(patch) => setOpts((prev) => ({ ...prev, ...patch }))}
              />
              <ActionBar
                busy={progress.busy}
                onPreview={runPreview}
                onStart={runCopy}
                onZip={runZip}
                onUndo={runUndo}
                onCancel={cancel}
              />
              <ProgressRunway
                pct={progress.pct}
                status={progress.status}
                busy={progress.busy}
                donePose={progress.donePose}
                act={progress.act}
                say={progress.say}
                actUrl={progress.actUrl}
              />
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
      <Toast message={toast.message} visible={toast.visible} />
      <Modal open={modalOpen} title={modalTitle} onClose={closeModal}>
        {modal.kind === "preview" ? (
          <PreviewResult preview={modal.preview} />
        ) : null}
        {modal.kind === "done" ? (
          <>
            <p>{modal.summary}</p>
            <StorageTips tipKind={modal.tipKind} />
            <RankPanel
              months={rank.months}
              folder={rank.folder}
              from={rank.from}
              to={rank.to}
              consent={rank.consent}
              status={rank.status}
              loading={rank.loading}
              error={rank.error}
              result={rank.result}
              meLabel={
                subscribe.me?.email
                  ? `${subscribe.me.email} · 이번 세션 구독`
                  : undefined
              }
              onFolder={rank.setFolder}
              onFrom={rank.setFrom}
              onTo={rank.setTo}
              onConsent={rank.setConsent}
              onSample={rank.runSample}
              onTop10={rank.runTop10}
            />
            <SkippedList items={modal.skipped} />
          </>
        ) : null}
      </Modal>
    </>
  );
}
