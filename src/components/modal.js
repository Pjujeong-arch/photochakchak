import { escapeHtml } from "../lib/index.js";


/** @param {{ modal?: HTMLElement | null, modalTitle?: HTMLElement | null, modalBody?: HTMLElement | null }} els */
export function createModal(els) {
  function close() {
    if (els.modal) els.modal.hidden = true;
  }

  return {
    close,
    /** @param {string} title @param {string} html */
    open(title, html) {
      if (!els.modal || !els.modalTitle || !els.modalBody) return;
      els.modalTitle.textContent = title;
      els.modalBody.innerHTML = html;
      els.modal.hidden = false;
    },
    bind() {
      document.querySelectorAll("[data-modal-close]").forEach((el) => {
        el.addEventListener("click", close);
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });
    },
    /** @param {Array<{ folder: string, name: string, reason: string, source?: string }>} items */
    skippedTable(items) {
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
    },
  };
}
