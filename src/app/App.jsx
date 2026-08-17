import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionBar,
  FolderPickButton,
  Modal,
  OptionChecks,
  PreviewResult,
  ProgressRunway,
  RankGallery,
  RankPanel,
  RankWaitReel,
  Reel,
  SiteFooter,
  SkippedList,
  StorageTips,
  SubscribeBar,
  SubscribeOffer,
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
  const [loginOpen, setLoginOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const wakeLock = useWakeLock({
    running: progress.busy,
    keepAwake,
  });
  const subscribe = useSubscribe(toast);
  const { mountButton, me, clientId, authLoading } = subscribe;
  const meRef = useRef(subscribe.me);
  meRef.current = me;
  const openLoginModal = useCallback(() => {
    if (!meRef.current?.email) setLoginOpen(true);
  }, []);
  const closeLoginModal = useCallback(() => setLoginOpen(false), []);
  const openOffer = useCallback(() => setOfferOpen(true), []);
  const closeOffer = useCallback(() => setOfferOpen(false), []);
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
    ensureDest: folders.ensureDest,
    toast,
    progress,
    wakeLock,
    setKeepAwake,
  });
  const rank = useRank({
    files: folders.files,
    preview,
    me,
    toast,
    onNeedLogin: openLoginModal,
    onNeedSubscribe: openOffer,
  });
  const [waitOpen, setWaitOpen] = useState(false);
  const [waitKey, setWaitKey] = useState(0);
  const waitFilled = useRef(true);
  const rankLoading = useRef(false);
  rankLoading.current = rank.loading;

  useEffect(() => {
    if (!rank.loading) return;
    waitFilled.current = false;
    setWaitKey((n) => n + 1);
    setWaitOpen(true);
  }, [rank.loading]);

  const revealGallery = rank.revealGallery;
  const finishWait = useCallback(() => {
    setWaitOpen(false);
    revealGallery();
  }, [revealGallery]);

  useEffect(() => {
    if (rank.loading || !waitFilled.current || !waitOpen) return;
    finishWait();
  }, [rank.loading, waitOpen, finishWait]);

  const onWaitFilled = useCallback(() => {
    waitFilled.current = true;
    if (!rankLoading.current) finishWait();
  }, [finishWait]);

  useEffect(() => {
    clearPreview();
  }, [folders.files, folders.destHandle, clearPreview]);

  useEffect(() => {
    if (!loginOpen) return undefined;
    mountButton();
    return undefined;
  }, [loginOpen, me, clientId, mountButton]);

  useEffect(() => {
    if (!loginOpen || !me?.email || authLoading) return;
    setLoginOpen(false);
  }, [loginOpen, me, authLoading]);

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
              <div className="folder-picks">
                <FolderPickButton
                  variant="source"
                  label={
                    folders.phone
                      ? "[1] 정리할 사진·영상 고르기"
                      : "[1] 정리할 폴더 (사진·영상·기타)"
                  }
                  name={folders.sourcePick.name}
                  meta={folders.sourcePick.meta}
                  picked={folders.sourcePick.picked}
                  disabled={progress.busy}
                  onClick={folders.openSourcePicker}
                />
                <input
                  ref={folders.folderInputRef}
                  id="source-folder-input"
                  type="file"
                  multiple
                  hidden
                  {...{ webkitdirectory: "", directory: "" }}
                  onChange={folders.onSourceChange}
                />
                <input
                  ref={folders.fileInputRef}
                  id="source-file-input"
                  type="file"
                  multiple
                  hidden
                  onChange={folders.onSourceChange}
                />
                <FolderPickButton
                  variant="dest"
                  label={
                    folders.phone
                      ? "[2] 정리본 저장 — 앱 안 폴더"
                      : "[2] 정리본 저장 — 폴더 만들기 (원본과 다른 위치)"
                  }
                  name={folders.destPick.name}
                  meta={folders.destPick.meta}
                  picked={folders.destPick.picked}
                  disabled={progress.busy}
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
                suppressed={
                  modalOpen ||
                  loginOpen ||
                  offerOpen ||
                  Boolean(rank.gallery) ||
                  rank.loading ||
                  waitOpen
                }
              />
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
      <Toast message={toast.message} visible={toast.visible} />
      <Modal open={modalOpen && !loginOpen} title={modalTitle} onClose={closeModal}>
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
                me?.email
                  ? me.subscribed
                    ? `${me.email} · 구독 중`
                    : `${me.email} · 샘플만`
                  : undefined
              }
              onFolder={rank.setFolder}
              onFrom={rank.setFrom}
              onTo={rank.setTo}
              onConsent={rank.setConsent}
              onSample={rank.runSample}
              onTop10={rank.runTop10}
              onOpenSample={rank.openSampleGallery}
              onOpenTop10={rank.openTop10Gallery}
              onOpenSubscribe={openOffer}
            />
            <SkippedList items={modal.skipped} />
          </>
        ) : null}
      </Modal>
      <Modal
        open={loginOpen}
        title="구글 로그인"
        onClose={closeLoginModal}
        closeLabel={null}
        layer="top"
        solid
      >
        <p className="login-modal__hint">
          폴더 정리는 로그인 없이 끝난 상태입니다. 사진 추천은 구독 기능이라,
          진행하려면 구글 계정으로 로그인해 주세요.
        </p>
        {me?.email ? (
          <p className="login-modal__ok">{me.email}</p>
        ) : null}
        <div className="login-modal__actions">
          <button
            className="login-modal__later"
            type="button"
            onClick={closeLoginModal}
          >
            나중에
          </button>
          <SubscribeBar
            btnRef={subscribe.btnRef}
            showLogout={Boolean(me?.email)}
            onLogout={subscribe.logout}
            onPaint={mountButton}
            loading={subscribe.loading}
            authLoading={subscribe.authLoading}
            error={subscribe.error}
          />
        </div>
      </Modal>
      <Modal
        open={waitOpen}
        title="포메가 사진을 보는 중"
        onClose={() => {}}
        closeLabel={null}
        layer="top"
        bare
      >
        <RankWaitReel
          key={waitKey}
          status={rank.status}
          pct={rank.fillPct}
          loading={rank.loading}
          onFilled={onWaitFilled}
        />
      </Modal>
      <Modal
        open={Boolean(rank.gallery && rank.result)}
        title={rank.gallery === "top10" ? "베스트 10" : "샘플 추천"}
        onClose={rank.closeGallery}
        closeLabel="닫기"
        layer="top"
        size="wide"
      >
        {rank.gallery && rank.result ? (
          <RankGallery
            mode={rank.gallery}
            result={rank.result}
            subscribed={Boolean(me?.subscribed)}
            onSubscribe={() => {
              rank.closeGallery();
              openOffer();
            }}
            onCopyToFolder={rank.copyPicks}
          />
        ) : null}
      </Modal>
      <Modal
        open={offerOpen}
        title="포토착착 구독"
        onClose={closeOffer}
        closeLabel="닫기"
        layer="top"
      >
        <SubscribeOffer
          email={me?.email}
          subscribed={Boolean(me?.subscribed)}
          paying={subscribe.authLoading}
          onLogin={() => {
            closeOffer();
            openLoginModal();
          }}
          onPay={async () => {
            const user = await subscribe.startPlan();
            if (user?.subscribed) closeOffer();
          }}
        />
      </Modal>
    </>
  );
}
