import { useEffect, useState } from "react";

const SHOTS = [
  {
    key: "a",
    src: "img/pome-2024-03.png",
    alt: "봄 포메라이언",
    tab: "2024-03",
    video: false,
    misc: false,
  },
  {
    key: "b",
    src: "img/pome-2024-11.png",
    alt: "가을 포메라이언 영상",
    tab: "2024-11",
    video: true,
    misc: false,
  },
  {
    key: "c",
    src: "img/pome-2025-01.png",
    alt: "날짜 없는 포메라이언",
    tab: "미분류",
    video: false,
    misc: true,
  },
];

const LINES = [
  { at: 0, text: "멍멍… 사진이랑 영상 막 쌓여있어 왈" },
  { at: 2900, text: "킁킁! 2024-03 폴더로 착착 ♡" },
  { at: 5100, text: "영상도 연도월 폴더로 간다멍!" },
  { at: 6900, text: "이 영상은 2024-11이야 왈왈" },
  { at: 10800, text: "날짜 모르면 미분류다개" },
  { at: 13000, text: "원본은 안 물어~ 복사만 한다멍!" },
];

export function Reel() {
  const [caption, setCaption] = useState(LINES[0].text);

  useEffect(() => {
    const started = performance.now();
    let last = "";
    let frame = 0;
    const tick = (now) => {
      const t = (now - started) % 18000;
      let text = LINES[0].text;
      for (let i = 0; i < LINES.length; i += 1) {
        if (t >= LINES[i].at) text = LINES[i].text;
      }
      if (text !== last) {
        last = text;
        setCaption(text);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="reel" aria-label="포토착착 설명 영상">
      <div className="reel__stage">
        <div className="logo">포토착착</div>
        {SHOTS.map((shot) => (
          <article
            key={shot.key}
            className={`shot shot--${shot.key}${shot.video ? " shot--video" : ""}`}
          >
            <img src={shot.src} alt={shot.alt} />
          </article>
        ))}
        {SHOTS.map((shot) => (
          <div
            key={`bin-${shot.key}`}
            className={`bin bin--${shot.key}${shot.misc ? " bin--misc" : ""}`}
          >
            <div className="bin__tab">{shot.tab}</div>
            <div className="bin__pocket">
              <img
                className={`bin__thumb bin__thumb--${shot.key}`}
                src={shot.src}
                alt=""
              />
            </div>
          </div>
        ))}
        <p className="reel__cap">
          <span>{caption}</span>
        </p>
      </div>
    </section>
  );
}
