const POMES = [
  { src: "/img/runway/pome-act-idle.png", alt: "대기하는 크림 포메" },
  { src: "/img/runway/pome-act-run.png", alt: "달리는 크림 포메" },
  { src: "/img/runway/pome-act-jump.png", alt: "점프하는 크림 포메" },
  { src: "/img/runway/pome-act-cute.png", alt: "재롱 부리는 크림 포메" },
  { src: "/img/runway/pome-act-highfive.png", alt: "하이파이브하는 크림 포메" },
  { src: "/img/runway/pome-act-bark.png", alt: "짖는 크림 포메" },
  { src: "/img/runway/pome-act-eat.png", alt: "밥 먹는 크림 포메" },
  { src: "/img/runway/pome-act-drink.png", alt: "물 마시는 크림 포메" },
  { src: "/img/runway/pome-act-lie.png", alt: "눕는 크림 포메" },
  { src: "/img/runway/pome-act-sleep.png", alt: "잠든 크림 포메" },
  { src: "/img/runway/pome-act-playdead.png", alt: "죽는 시늉하는 크림 포메" },
];

/**
 * @param {{ status?: string }} props
 */
export function RankWaitReel({ status = "" }) {
  const strip = POMES.concat(POMES);

  return (
    <div className="rank-wait">
      <div className="rank-wait__stage" aria-hidden="true">
        <div className="rank-wait__roll">
          {strip.map((shot, i) => (
            <img key={`${shot.src}-${i}`} src={shot.src} alt="" />
          ))}
        </div>
      </div>
      <p className="rank-wait__status" aria-live="polite">
        {status || "Gemini가 축소본을 읽는 중…"}
      </p>
    </div>
  );
}
