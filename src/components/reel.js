import { escapeHtml } from "../lib/index.js";

const SHOTS = [
  { key: "a", src: "img/pome-2024-03.png", alt: "봄 포메라이언", tab: "2024-03", video: false, misc: false },
  { key: "b", src: "img/pome-2024-11.png", alt: "가을 포메라이언 영상", tab: "2024-11", video: true, misc: false },
  { key: "c", src: "img/pome-2025-01.png", alt: "날짜 없는 포메라이언", tab: "미분류", video: false, misc: true },
];

const LINES = [
  { at: 0, text: "멍멍… 사진이랑 영상 막 쌓여있어 왈" },
  { at: 2900, text: "킁킁! 2024-03 폴더로 착착 ♡" },
  { at: 5100, text: "영상도 연도월 폴더로 간다멍!" },
  { at: 6900, text: "이 영상은 2024-11이야 왈왈" },
  { at: 10800, text: "날짜 모르면 미분류다개" },
  { at: 13000, text: "원본은 안 물어~ 복사만 한다멍!" },
];

function mountStage() {
  const stage = document.querySelector("[data-reel-stage]");
  if (!stage || stage.querySelector(".shot")) return;
  const logo = stage.querySelector(".logo");
  const cap = stage.querySelector(".reel__cap");
  const shots = SHOTS.map(
    (shot) =>
      `<article class="shot shot--${shot.key}${shot.video ? " shot--video" : ""}">
        <img src="${escapeHtml(shot.src)}" alt="${escapeHtml(shot.alt)}" />
      </article>`
  ).join("");
  const bins = SHOTS.map(
    (shot) =>
      `<div class="bin bin--${shot.key}${shot.misc ? " bin--misc" : ""}">
        <div class="bin__tab">${escapeHtml(shot.tab)}</div>
        <div class="bin__pocket">
          <img class="bin__thumb bin__thumb--${shot.key}" src="${escapeHtml(shot.src)}" alt="" />
        </div>
      </div>`
  ).join("");
  const html = `${shots}${bins}`;
  if (logo && cap) {
    logo.insertAdjacentHTML("afterend", html);
  } else {
    stage.insertAdjacentHTML("afterbegin", html);
  }
}

export function bindReel() {
  mountStage();
  const cap = document.querySelector("[data-dog-cap]");
  if (!cap) return;
  const node = cap;
  const cycle = 18000;
  const started = performance.now();
  let last = "";
  function tick(now) {
    const t = (now - started) % cycle;
    let text = LINES[0].text;
    for (let i = 0; i < LINES.length; i += 1) {
      if (t >= LINES[i].at) text = LINES[i].text;
    }
    if (text !== last) {
      last = text;
      node.textContent = text;
    }
    window.requestAnimationFrame(tick);
  }
  window.requestAnimationFrame(tick);
}
