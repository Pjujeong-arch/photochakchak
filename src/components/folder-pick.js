import { escapeHtml } from "../lib/index.js";

const FOLDER_ICON =
  '<path d="M3.5 8.5V7a2 2 0 0 1 2-2h4.2l1.6 1.8H18.5A2 2 0 0 1 20.5 9v8.2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V8.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>';

const PICKS = [
  {
    key: "source",
    label: "[1] 정리할 폴더 (사진·영상·기타)",
    nameAttr: "data-source-name",
    metaAttr: "data-source-meta",
    btnAttr: "data-pick-source",
    meta: "정리할 사진·영상·기타를 담아요",
    extraIcon: "",
    input: true,
  },
  {
    key: "dest",
    label: "[2] 정리본 저장 폴더 (원본과 다른 위치, 연도월·미분류·기타파일)",
    nameAttr: "data-dest-name",
    metaAttr: "data-dest-meta",
    btnAttr: "data-pick-dest",
    meta: "원본과 다른 위치에 복사해요",
    extraIcon:
      '<path d="M12 11.2v6.2M9.4 15l2.6 2.4L14.6 15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    input: false,
  },
];

/** @param {HTMLButtonElement | null} btn */
export function paintPick(btn, nameEl, metaEl, picked, name, meta) {
  if (nameEl) nameEl.textContent = name;
  if (metaEl) metaEl.textContent = meta;
  if (btn) {
    btn.classList.toggle("is-picked", Boolean(picked));
    btn.title = picked ? name : "";
  }
}

export function mountFolderPicks() {
  const host = document.querySelector("[data-folder-picks]");
  if (!host) return;
  host.innerHTML = PICKS.map((pick) => {
    const destClass = pick.key === "dest" ? " pick__icon--dest" : "";
    const input = pick.input
      ? '<input id="source-input" type="file" webkitdirectory multiple hidden />'
      : "";
    return `<div class="field">
      <span class="field__label">${escapeHtml(pick.label)}</span>
      <div class="field__row">
        <button class="btn btn--pick" type="button" ${pick.btnAttr}>
          <span class="pick__icon${destClass}" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">${FOLDER_ICON}${pick.extraIcon}</svg>
          </span>
          <span class="pick__copy">
            <strong class="pick__name" ${pick.nameAttr}>폴더 선택</strong>
            <span class="pick__meta" ${pick.metaAttr}>${escapeHtml(pick.meta)}</span>
          </span>
        </button>
        ${input}
      </div>
    </div>`;
  }).join("");
}
