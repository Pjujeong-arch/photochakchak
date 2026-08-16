const ACTS = [
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

export function createPome(els) {
  const cache = new Map();
  let timer = 0;
  let index = 0;
  let paint = 0;
  let refs = { on: els.pomeShot, next: els.pomeNext };

  function url(id) {
    return new URL(`img/runway/pome-act-${id}.png`, document.baseURI).href;
  }

  function preload() {
    ["idle"].concat(ACTS.map((a) => a.id)).forEach((id) => {
      const img = new Image();
      img.decoding = "async";
      img.src = url(id);
      cache.set(id, img);
    });
  }

  function place(pct) {
    const pome = els.pome;
    if (!pome || !pome.parentElement) return;
    const max = Math.max(0, pome.parentElement.clientWidth - pome.offsetWidth);
    pome.style.left = `${(pct / 100) * max}px`;
  }

  function show(id) {
    const href = url(id);
    const on = refs.on;
    const next = refs.next;
    if (!on) return;
    if (on.classList.contains("is-on") && on.complete && on.naturalWidth && on.src === href) return;
    const token = (paint += 1);
    const paintNow = () => {
      if (token !== paint) return;
      if (!next) {
        on.src = href;
        on.classList.add("is-on");
        return;
      }
      const reveal = () => {
        if (token !== paint) return;
        next.classList.add("is-on");
        on.classList.remove("is-on");
        refs = { on: next, next: on };
        next.onload = null;
      };
      next.onload = reveal;
      if (next.complete && next.naturalWidth && next.src === href) reveal();
      else next.src = href;
    };
    const cached = cache.get(id);
    if (cached && cached.complete && cached.naturalWidth > 0) {
      paintNow();
      return;
    }
    const loader = cached || new Image();
    loader.onload = paintNow;
    loader.onerror = paintNow;
    loader.src = href;
    cache.set(id, loader);
  }

  function setAct(id, say) {
    if (!els.pome) return;
    els.pome.dataset.act = id;
    if (els.pomeSay && say) els.pomeSay.textContent = say;
    show(id);
  }

  function stop(resetting) {
    if (timer) {
      window.clearInterval(timer);
      timer = 0;
    }
    if (!els.pome || resetting) return;
    els.pome.classList.remove("is-busy");
    const done = Number(els.progress.value) >= 99.5;
    els.pome.classList.toggle("is-done", done);
    setAct(done ? "cute" : "idle", done ? "다 했다멍 ♡" : "멍!");
  }

  function start() {
    if (!els.pome) return;
    stop(true);
    els.pome.classList.add("is-busy");
    els.pome.classList.remove("is-done");
    index = 0;
    setAct(ACTS[0].id, ACTS[0].say);
    timer = window.setInterval(() => {
      index = (index + 1) % ACTS.length;
      setAct(ACTS[index].id, ACTS[index].say);
    }, 1600);
  }

  return { preload, place, start, stop };
}
