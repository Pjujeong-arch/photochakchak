export function bindChrome(els) {
  if (els.year) els.year.textContent = String(new Date().getFullYear());
}
