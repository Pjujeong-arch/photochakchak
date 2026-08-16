export function createToast(els) {
  /** @type {number} */
  let timer = 0;
  return {
    /** @param {string} message */
    show(message) {
      if (!els.toast) return;
      els.toast.textContent = message;
      els.toast.classList.add("is-visible");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2400);
    },
  };
}
