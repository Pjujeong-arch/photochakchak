const {
  analyzeFiles,
  copyToDirectory,
  copyToZip,
  formatBytes,
  isImageFile,
  undoLastRun,
} = window.PhotoChak;

const $ = (sel) => document.querySelector(sel);

const els = {
  nav: $(".site-nav"),
  toggle: $(".menu-toggle"),
  year: $("[data-year]"),
  toast: $(".toast"),
  sourceBtn: $("[data-pick-source]"),
  sourceInput: $("#source-input"),
  sourceName: $("[data-source-name]"),
  sourceMeta: $("[data-source-meta]"),
  destBtn: $("[data-pick-dest]"),
  destName: $("[data-dest-name]"),
  destMeta: $("[data-dest-meta]"),
  fallback: $("#opt-fallback"),
  skipDup: $("#opt-dup"),
  videoDup: $("#opt-video-dup"),
  previewBtn: $("[data-preview]"),
  startBtn: $("[data-start]"),
  zipBtn: $("[data-zip]"),
  undoBtn: $("[data-undo]"),
  cancelBtn: $("[data-cancel]"),
  progress: $("#progress"),
  pome: $("[data-pome]"),
  pomeSay: $("[data-pome-say]"),
  pomeShot: $("[data-pome-shot]"),
  pomeNext: $("[data-pome-next]"),
  status: $("[data-status]"),
  log: $("#log"),
  modal: $("[data-modal]"),
  modalTitle: $("[data-modal-title]"),
  modalBody: $("[data-modal-body]"),
};

const state = {
  files: [],
  destHandle: null,
  preview: null,
  running: false,
  cancelled: false,
  keepAwake: false,
};

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2400);
}

function logLine(message) {
  if (!els.log) return;
  els.log.textContent += message + "\n";
  els.log.scrollTop = els.log.scrollHeight;
}

function clearLog() {
  if (!els.log) return;
  els.log.textContent = "";
}

function closeModal() {
  if (els.modal) els.modal.hidden = true;
}

function openModal(title, html) {
  if (!els.modal) return;
  els.modalTitle.textContent = title;
  els.modalBody.innerHTML = html;
  els.modal.hidden = false;
}

function bindModal() {
  document.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
}

function skippedTable(items) {
  if (!items || !items.length) {
    return `<p class="modal__empty">복사되지 않은 파일이 없습니다.</p>`;
  }
  const rows = items
    .map(
      (item) => `<li>
        <span class="modal__folder">${escapeHtml(item.folder)}</span>
        <span class="modal__file">${escapeHtml(item.name)}</span>
        <span class="modal__why">${escapeHtml(item.reason)}${item.source ? ` · 원본 ${escapeHtml(item.source)}` : ""}</span>
      </li>`
    )
    .join("");
  return `<p>복사되지 않은 파일 ${items.length.toLocaleString()}개</p><ul class="modal__list">${rows}</ul>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const POME_ACTS = [
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

let pomeActTimer = 0;
let pomeActIndex = 0;
let etaRate = null;
let pomeActId = "idle";
const pomeCache = new Map();

function pomeUrl(id) {
  return new URL(`img/runway/pome-act-${id}.png`, document.baseURI).href;
}

function preloadPomeShots() {
  ["idle"].concat(POME_ACTS.map((act) => act.id)).forEach((id) => {
    const img = new Image();
    img.decoding = "async";
    img.src = pomeUrl(id);
    pomeCache.set(id, img);
  });
}

let pomePaint = 0;

function showPomeShot(id) {
  const url = pomeUrl(id);
  const on = els.pomeShot;
  const next = els.pomeNext;
  if (!on) return;
  if (on.classList.contains("is-on") && on.complete && on.naturalWidth && on.src === url) return;

  const token = (pomePaint += 1);
  const paint = () => {
    if (token !== pomePaint) return;
    if (!next) {
      on.src = url;
      on.classList.add("is-on");
      return;
    }
    const reveal = () => {
      if (token !== pomePaint) return;
      next.classList.add("is-on");
      on.classList.remove("is-on");
      els.pomeShot = next;
      els.pomeNext = on;
      next.onload = null;
    };
    next.onload = reveal;
    if (next.complete && next.naturalWidth && next.src === url) {
      reveal();
      return;
    }
    next.src = url;
  };

  const cached = pomeCache.get(id);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    paint();
    return;
  }
  const loader = cached || new Image();
  loader.onload = paint;
  loader.onerror = paint;
  loader.src = url;
  pomeCache.set(id, loader);
}

function setProgressPct(pct) {
  const value = Math.max(0, Math.min(100, Number(pct) || 0));
  els.progress.value = value;
  placePome(value);
}

function placePome(pct) {
  const pome = els.pome;
  if (!pome) return;
  const runway = pome.parentElement;
  if (!runway) return;
  const max = Math.max(0, runway.clientWidth - pome.offsetWidth);
  pome.style.left = `${(pct / 100) * max}px`;
}

function setPomeAct(id, say) {
  const pome = els.pome;
  if (!pome) return;
  pome.dataset.act = id;
  pomeActId = id;
  if (els.pomeSay && say) els.pomeSay.textContent = say;
  showPomeShot(id);
}

function startPomeShow() {
  const pome = els.pome;
  if (!pome) return;
  stopPomeShow(true);
  pome.classList.add("is-busy");
  pome.classList.remove("is-done");
  pomeActIndex = 0;
  setPomeAct(POME_ACTS[0].id, POME_ACTS[0].say);
  pomeActTimer = window.setInterval(() => {
    pomeActIndex = (pomeActIndex + 1) % POME_ACTS.length;
    const act = POME_ACTS[pomeActIndex];
    setPomeAct(act.id, act.say);
  }, 1600);
}

function stopPomeShow(resetting) {
  if (pomeActTimer) {
    window.clearInterval(pomeActTimer);
    pomeActTimer = 0;
  }
  const pome = els.pome;
  if (!pome || resetting) return;
  pome.classList.remove("is-busy");
  const done = Number(els.progress.value) >= 99.5;
  pome.classList.toggle("is-done", done);
  setPomeAct(done ? "cute" : "idle", done ? "다 했다멍 ♡" : "멍!");
}

let wakeLockSentinel = null;

async function holdCopyWakeLock() {
  if (!state.keepAwake) return;
  if (!navigator.wakeLock || !navigator.wakeLock.request) return;
  try {
    if (wakeLockSentinel && wakeLockSentinel.released === false) return;
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      if (state.running && state.keepAwake && document.visibilityState === "visible") {
        holdCopyWakeLock();
      }
    });
  } catch (_err) {
    wakeLockSentinel = null;
  }
}

async function releaseCopyWakeLock() {
  state.keepAwake = false;
  const lock = wakeLockSentinel;
  wakeLockSentinel = null;
  if (lock) {
    try {
      await lock.release();
    } catch (_err) {
      /* ignore */
    }
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.running && state.keepAwake) {
    holdCopyWakeLock();
  }
});

function setBusy(busy) {
  state.running = busy;
  [els.previewBtn, els.startBtn, els.zipBtn, els.undoBtn, els.sourceBtn].forEach((btn) => {
    if (btn) btn.disabled = busy;
  });
  if (els.destBtn) els.destBtn.disabled = busy || !canPickDir();
  if (els.cancelBtn) els.cancelBtn.disabled = !busy;
  if (busy) {
    etaRate = null;
    setProgressPct(0);
    startPomeShow();
  } else {
    stopPomeShow();
  }
}

function cancelled() {
  return state.cancelled;
}

function closeMenu() {
  if (!els.nav || !els.toggle) return;
  els.nav.classList.remove("is-open");
  els.toggle.setAttribute("aria-expanded", "false");
}

function bindChrome() {
  if (els.year) els.year.textContent = String(new Date().getFullYear());
  if (els.toggle && els.nav) {
    els.toggle.addEventListener("click", () => {
      const open = els.nav.classList.toggle("is-open");
      els.toggle.setAttribute("aria-expanded", String(open));
    });
    els.nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  }
}

function collectImages(fileList) {
  return Array.from(fileList).filter(isImageFile);
}

function folderNameFromFiles(files) {
  const file = files && files[0];
  if (!file) return "";
  const rel = String(file.webkitRelativePath || "").replace(/\\/g, "/");
  if (rel.includes("/")) return rel.split("/").filter(Boolean)[0] || "";
  return "선택한 폴더";
}

function paintPick(btn, nameEl, metaEl, picked, name, meta) {
  if (nameEl) nameEl.textContent = name;
  if (metaEl) metaEl.textContent = meta;
  if (btn) {
    btn.classList.toggle("is-picked", Boolean(picked));
    btn.title = picked ? name : "";
  }
}

function bindSource() {
  els.sourceBtn.addEventListener("click", () => els.sourceInput.click());
  els.sourceInput.addEventListener("change", () => {
    state.files = collectImages(els.sourceInput.files || []);
    state.preview = null;
    const folder = folderNameFromFiles(state.files);
    if (state.files.length && folder) {
      paintPick(
        els.sourceBtn,
        els.sourceName,
        els.sourceMeta,
        true,
        folder,
        `${state.files.length.toLocaleString()}개 담김 · 다시 고르려면 누르기`
      );
      showToast(`${folder}에서 ${state.files.length}개 파일을 담았습니다.`);
    } else {
      paintPick(
        els.sourceBtn,
        els.sourceName,
        els.sourceMeta,
        false,
        "폴더 선택",
        "정리할 사진·영상·기타를 담아요"
      );
      showToast("파일이 없습니다.");
    }
  });
}

function canPickDir() {
  return typeof window.showDirectoryPicker === "function";
}

function bindDest() {
  if (!canPickDir()) {
    els.destBtn.disabled = true;
    paintPick(els.destBtn, els.destName, els.destMeta, false, "폴더 저장 불가", "이 브라우저는 ZIP으로 받으세요");
    showToast("이 브라우저는 폴더 저장 미지원 · ZIP으로 받으세요");
    return;
  }
  els.destBtn.addEventListener("click", async () => {
    try {
      state.destHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      state.preview = null;
      const name = state.destHandle.name || "저장 폴더";
      paintPick(
        els.destBtn,
        els.destName,
        els.destMeta,
        true,
        name,
        "여기에 연월·미분류·기타파일로 복사 · 다시 고르려면 누르기"
      );
      showToast(`${name} 폴더에 저장합니다.`);
    } catch (_err) {
      /* user cancelled */
    }
  });
}

function options() {
  const flags = {
    skipDuplicates: els.skipDup.checked,
    hashVideos: Boolean(els.videoDup && els.videoDup.checked),
    useFallbacks: els.fallback.checked,
  };
  const preview = state.preview;
  const samePlan =
    preview &&
    preview.items &&
    preview.planFlags &&
    preview.planFlags.skipDuplicates === flags.skipDuplicates &&
    preview.planFlags.hashVideos === flags.hashVideos &&
    preview.planFlags.useFallbacks === flags.useFallbacks;
  return {
    ...flags,
    planItems: samePlan ? preview.items : null,
    cancelled,
  };
}

function folderSummary(byFolder) {
  return Object.entries(byFolder)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

function renderPreview(result) {
  state.preview = result;
  const kind = result.byKind || { photo: 0, video: 0, other: 0 };
  const est = (result.bySource.filename || 0) + (result.bySource.filedate || 0);
  els.status.textContent =
    `미리보기 완료 — 사진 ${kind.photo.toLocaleString()} · 영상 ${kind.video.toLocaleString()} · 기타 ${kind.other.toLocaleString()}`;
  setProgressPct(result.total ? 100 : 0);
  openModal(
    "미리보기 결과",
    `<div class="modal__counts">
      <div class="modal__stat"><b>${kind.photo.toLocaleString()}</b><span>사진</span></div>
      <div class="modal__stat"><b>${kind.video.toLocaleString()}</b><span>동영상</span></div>
      <div class="modal__stat"><b>${kind.other.toLocaleString()}</b><span>기타파일</span></div>
    </div>
    <p>복사 예정 ${(result.total - result.duplicates).toLocaleString()}개 · 중복 ${result.duplicates.toLocaleString()}개 · 미분류 ${(result.bySource.none || 0).toLocaleString()}개</p>
    <p>필요 용량 약 ${formatBytes(result.bytesNeeded)}${est ? ` · 날짜 추정 ${est.toLocaleString()}개` : ""}</p>
    <p class="modal__woof-note">기타파일은 사진·영상이 아닌 파일을 모아둘 곳이야 왈. 영상은 기본으로 중복검사를 건너뛰어 배터리를 아낀다멍.</p>`
  );
}

async function runPreview() {
  if (state.running) return;
  if (!state.files.length) {
    showToast("정리할 사진 폴더를 먼저 선택해 주세요.");
    return;
  }
  state.cancelled = false;
  clearLog();
  logLine("— 미리보기 시작: 분류 예정 경로·중복·필요 용량을 계산합니다 —");
  setBusy(true);
  const startedAt = performance.now();
  els.status.textContent = "분석 시작 · 남은 시간 계산 중…";
  try {
    const result = await analyzeFiles(state.files, options(), (done, total) => {
      setProgressPct(total ? (done / total) * 100 : 0);
      els.status.textContent = progressLabel(done, total, startedAt, "분석 중");
    });
    renderPreview(result);
  } catch (err) {
    if (String(err.message) === "cancelled_preview") {
      els.status.textContent = "미리보기를 중지했습니다.";
      logLine("미리보기 중지됨");
    } else {
      els.status.textContent = "오류로 중단 — 원본 유지";
      logLine(`[오류] ${err.message || err}`);
    }
  } finally {
    setBusy(false);
  }
}

function confirmCopy(kind) {
  if (!state.preview) {
    return window.confirm("아직 미리보기를 안 하셨습니다.\n그래도 바로 복사할까요?");
  }
  const needed = state.preview.bytesNeeded;
  const copyCount = state.preview.total - state.preview.duplicates;
  return window.confirm(
    `${kind}을 시작합니다.\n· 복사 예정: ${copyCount.toLocaleString()}장\n· 중복 스킵: ${state.preview.duplicates.toLocaleString()}장\n· 필요 용량: 약 ${formatBytes(needed)}\n\n원본은 그대로 두고 복사만 합니다.`
  );
}

function formatRemain(ms) {
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

function progressLabel(done, total, startedAt, verb, extra) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const head = verb ? `${verb} ` : "";
  const counts = `${head}${pct}% (${done.toLocaleString()}/${total.toLocaleString()})`;
  const fileBit =
    extra && extra.bytesTotal
      ? ` · ${formatBytes(extra.bytesWritten || 0)}/${formatBytes(extra.bytesTotal)}`
      : "";
  if (done >= total) return counts;
  if (!done) {
    const elapsed = performance.now() - startedAt;
    if (elapsed < 350) return `${counts} · 남은 시간 계산 중…${fileBit}`;
  }
  const elapsed = performance.now() - startedAt;
  if (elapsed < 350) return `${counts} · 남은 시간 계산 중…${fileBit}`;
  const inst = Math.max(done, 0.25) / elapsed;
  etaRate = etaRate == null ? inst : etaRate * 0.72 + inst * 0.28;
  const remain = (total - Math.max(done, 0.25)) / Math.max(etaRate, 1e-9);
  const perSec = etaRate * 1000;
  const speed = total >= 200 && perSec >= 0.5 ? ` · 초당 ${perSec.toFixed(perSec >= 10 ? 0 : 1)}개` : "";
  return `${counts} · ${formatRemain(remain)}${speed}${fileBit}`;
}

function doneSummary(stats) {
  return (
    `완료 — EXIF ${stats.ok.toLocaleString()} · 추정 ${stats.estimated.toLocaleString()} · 미분류 ${stats.unclassified.toLocaleString()} · 기타 ${(stats.other || 0).toLocaleString()} · 중복스킵 ${stats.duplicate.toLocaleString()} · 실패 ${stats.error.toLocaleString()}`
  );
}

function doneWoofTips(kind) {
  const where = kind === "zip" ? "ZIP을 잘 받아뒀는지" : "새 폴더에 잘 들어왔는지";
  return `<div class="modal__woof">
    <p>다 복사했다멍! <b>기타파일</b>은 사진이랑 동영상이 아닌 파일을 모아둔 바구니야 왈.</p>
    <p>${where} 한 번만 킁킁 해보고, 괜찮으면 <b>예전 폴더는 지워도 된다개</b>. 그래야 용량이 절약돼 왈왈!</p>
    <p class="modal__woof-note">원본은 내가 안 지워~ 네가 직접 지우는 거야. 마음에 안 들면 「실행 취소」다멍.</p>
  </div>`;
}

async function runCopy() {
  if (state.running) return;
  if (!state.files.length) {
    showToast("정리할 사진 폴더를 먼저 선택해 주세요.");
    return;
  }
  if (!state.destHandle) {
    showToast("저장 폴더를 선택하거나 ZIP으로 받으세요.");
    return;
  }
  if (!confirmCopy("폴더 복사")) return;
  state.cancelled = false;
  clearLog();
  logLine("원본은 유지합니다. 문제는 「실행 취소」로 이번 복사본만 되돌릴 수 있습니다.");
  setBusy(true);
  state.keepAwake = true;
  await holdCopyWakeLock();
  const startedAt = performance.now();
  els.status.textContent = "분류 시작 · 절전 방지 · 남은 시간 계산 중…";
  try {
    const { stats, skipped } = await copyToDirectory(state.files, state.destHandle, options(), (done, total, msg, extra) => {
      setProgressPct(total ? (done / total) * 100 : 0);
      els.status.textContent = progressLabel(done, total, startedAt, "", extra);
    });
    const summary = doneSummary(stats);
    els.status.textContent = summary;
    openModal("분류 결과", `<p>${summary}</p>${doneWoofTips("folder")}${skippedTable(skipped)}`);
  } catch (err) {
    els.status.textContent = "오류로 중단 — 원본 유지";
    logLine(`[오류] ${err.message || err}`);
  } finally {
    await releaseCopyWakeLock();
    setBusy(false);
  }
}

async function runZip() {
  if (state.running) return;
  if (!state.files.length) {
    showToast("정리할 사진 폴더를 먼저 선택해 주세요.");
    return;
  }
  if (!confirmCopy("ZIP 받기")) return;
  state.cancelled = false;
  clearLog();
  logLine("원본은 유지합니다. 정리본을 ZIP으로 받습니다.");
  setBusy(true);
  state.keepAwake = true;
  await holdCopyWakeLock();
  const startedAt = performance.now();
  els.status.textContent = "ZIP 시작 · 절전 방지 · 남은 시간 계산 중…";
  try {
    const { stats, blob, skipped } = await copyToZip(state.files, options(), (done, total, msg, extra) => {
      setProgressPct(total ? (done / total) * 100 : 0);
      els.status.textContent = progressLabel(done, total, startedAt, "", extra);
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "포토착착_정리본.zip";
    a.click();
    URL.revokeObjectURL(url);
    const summary = doneSummary(stats);
    els.status.textContent = summary;
    openModal("ZIP 결과", `<p>${summary}</p>${doneWoofTips("zip")}${skippedTable(skipped)}`);
  } catch (err) {
    els.status.textContent = "오류로 중단 — 원본 유지";
    logLine(`[오류] ${err.message || err}`);
  } finally {
    await releaseCopyWakeLock();
    setBusy(false);
  }
}

async function runUndo() {
  if (state.running) return;
  if (!state.destHandle) {
    showToast("저장 폴더를 선택한 뒤에 실행 취소할 수 있습니다.");
    return;
  }
  if (!window.confirm("지난 실행에서 복사한 파일만 삭제합니다.\n원본 사진은 절대 건드리지 않습니다.")) return;
  setBusy(true);
  try {
    const { deleted, errors } = await undoLastRun(state.destHandle);
    logLine(`[실행취소] 복사본 ${deleted.toLocaleString()}개 삭제 · 실패 ${errors.toLocaleString()}`);
    els.status.textContent = `실행 취소 완료 — ${deleted.toLocaleString()}개 복사본 삭제 (원본 유지)`;
    showToast("이번 복사본만 되돌렸습니다.");
  } catch (err) {
    showToast(err.message || String(err));
  } finally {
    setBusy(false);
  }
}

function bindApp() {
  els.previewBtn.addEventListener("click", runPreview);
  els.startBtn.addEventListener("click", runCopy);
  els.zipBtn.addEventListener("click", runZip);
  els.undoBtn.addEventListener("click", runUndo);
  els.cancelBtn.addEventListener("click", () => {
    if (!state.running) return;
    state.cancelled = true;
    els.status.textContent = "중지 요청… 현재 파일만 마치고 멈춥니다.";
  });
}

function bindDogCaptions() {
  const cap = document.querySelector("[data-dog-cap]");
  if (!cap) return;
  const cycle = 18000;
  const lines = [
    { at: 0, text: "멍멍… 사진이랑 영상 막 쌓여있어 왈" },
    { at: 2900, text: "킁킁! 2024-03 폴더로 착착 ♡" },
    { at: 5100, text: "영상도 연도월 폴더로 간다멍!" },
    { at: 6900, text: "이 영상은 2024-11이야 왈왈" },
    { at: 10800, text: "날짜 모르면 미분류다개" },
    { at: 13000, text: "원본은 안 물어~ 복사만 한다멍!" },
  ];
  const started = performance.now();
  let last = "";

  function tick(now) {
    const t = (now - started) % cycle;
    let text = lines[0].text;
    for (let i = 0; i < lines.length; i += 1) {
      if (t >= lines[i].at) text = lines[i].text;
    }
    if (text !== last) {
      last = text;
      cap.textContent = text;
    }
    window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);
}

bindChrome();
bindModal();
bindSource();
bindDest();
bindApp();
bindDogCaptions();
preloadPomeShots();
setBusy(false);
placePome(Number(els.progress.value) || 0);
window.addEventListener("resize", () => placePome(Number(els.progress.value) || 0));
