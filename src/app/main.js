import { $ } from "../lib/index.js";
import { bindChrome, bindReel, createModal, createToast, mountFolderPicks } from "../components/index.js";
import { bindFolders, bindSort, createPome, createProgress, createWakeLock } from "../hooks/index.js";

bindReel();
mountFolderPicks();

const els = {
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

const toast = createToast(els);
const modal = createModal(els);
const pome = createPome(els);
const progress = createProgress(els, pome);
const wakeLock = createWakeLock(state);

bindChrome(els);
modal.bind();
bindFolders(els, state, toast);
pome.preload();
bindSort(els, state, { toast, modal, progress, pome, wakeLock });
